import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { connect, createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForAccepting(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const accepted = await new Promise((resolve) => {
      const socket = connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (accepted) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server did not start accepting connections on port ${port}`);
}

async function startServer(t, extraEnv = {}) {
  const port = await availablePort();
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        GROQ_API_KEY: "test-key",
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(() => child.kill("SIGTERM"));

  let output = "";
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Next.js did not start:\n${output}`)),
      30_000,
    );
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes("Ready in")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Next.js exited with code ${code}:\n${output}`));
    });
  });

  await waitForAccepting(port);

  return `http://127.0.0.1:${port}`;
}

async function startGroqMock(t) {
  let receivedBody;
  const server = createHttpServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      receivedBody = JSON.parse(raw);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${port}`, getBody: () => receivedBody };
}

test("POST /api/ai rejects malformed history entries before fixed replies", async (t) => {
  const origin = await startServer(t);

  const response = await fetch(`${origin}/api/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "hi?", history: [null] }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "invalid history",
    validation: {
      history: "must be an array of entries with role 'user' or 'assistant' and string content",
    },
  });
});

test("POST /api/ai rejects a non-string prompt with 400", async (t) => {
  const origin = await startServer(t);

  const response = await fetch(`${origin}/api/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: 123 }),
  });

  assert.equal(response.status, 400);
});

test("POST /api/ai coerces non-numeric max to a numeric max_tokens", async (t) => {
  const groq = await startGroqMock(t);
  const origin = await startServer(t, { GROQ_API_URL: groq.url });

  const response = await fetch(`${origin}/api/ai`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "what is tracecase?", max: "abc" }),
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, "ok");
  const sent = groq.getBody();
  assert.equal(typeof sent.max_tokens, "number");
  assert.ok(Number.isFinite(sent.max_tokens), `expected finite max_tokens, got ${sent.max_tokens}`);
});
