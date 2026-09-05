import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
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

async function startServer(t) {
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
        TRACECASE_INGEST_TOKEN: "test-token",
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
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

  return `http://127.0.0.1:${port}`;
}

test(
  "POST /api/runs rejects an empty results array before database access",
  async (t) => {
    const origin = await startServer(t);
    const infoResponse = await fetch(`${origin}/api/runs`);
    assert.equal(infoResponse.status, 200);
    assert.deepEqual((await infoResponse.json()).validation, {
      results: "must contain at least one result",
    });

    const response = await fetch(`${origin}/api/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tracecase-token": "test-token",
      },
      body: JSON.stringify({
        suite: "refund-agent",
        label: "empty run",
        results: [],
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "results[] must not be empty",
    });
  },
);
