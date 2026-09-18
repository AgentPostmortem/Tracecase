import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
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
        TRACECASE_INGEST_TOKEN: "test-token",
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
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

// Minimal in-memory PostgREST stand-in covering the exact queries the runs
// route (and the run page) make, so POST /api/runs can be exercised end to
// end. supabase-js resolves .maybeSingle() client-side from a JSON array and
// requests a bare object only for .single() via the Accept header.
function startFakeSupabase(t) {
  const suites = [];
  const runs = [];
  const results = [];
  let seq = 0;
  let lastStamp = 0;

  const nextId = () =>
    `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const nextStamp = () => {
    // Monotonic so "order=created_at.desc" never sees same-millisecond ties.
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    return new Date(lastStamp).toISOString();
  };
  const table = (name) =>
    name === "tc_suites" ? suites : name === "tc_runs" ? runs : results;

  function applyQuery(rows, params) {
    let out = rows;
    for (const [key, value] of params) {
      if (["select", "order", "limit", "range"].includes(key)) continue;
      const match = /^(eq|lt)\.(.*)$/.exec(value);
      if (!match) continue;
      const [, op, literal] = match;
      out = out.filter((row) =>
        op === "eq" ? String(row[key]) === literal : String(row[key]) < literal,
      );
    }
    const order = params.get("order");
    if (order) {
      const [column, direction] = order.split(".");
      out = [...out].sort((a, b) =>
        direction === "desc"
          ? String(b[column]).localeCompare(String(a[column]))
          : String(a[column]).localeCompare(String(b[column])),
      );
    }
    const limit = params.get("limit");
    if (limit != null) out = out.slice(0, Number(limit));
    const range = params.get("range");
    if (range != null) {
      const [start, end] = range.split(",").map(Number);
      out = out.slice(start, end + 1);
    }
    return out;
  }

  const server = createHttpServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const table_ = table(url.pathname.split("/").pop());
    const wantsObject = (req.headers.accept ?? "").includes(
      "vnd.pgrst.object+json",
    );
    const reply = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (req.method === "GET") {
        const matched = applyQuery(table_, url.searchParams);
        reply(200, wantsObject ? (matched[0] ?? null) : matched);
        return;
      }
      if (req.method === "POST") {
        const payload = JSON.parse(raw);
        const inserted = (Array.isArray(payload) ? payload : [payload]).map(
          (row) => ({
            id: nextId(),
            created_at: nextStamp(),
            ...row,
          }),
        );
        table_.push(...inserted);
        reply(201, wantsObject ? (inserted[0] ?? null) : inserted);
        return;
      }
      if (req.method === "DELETE") {
        const cutoff = url.searchParams.get("created_at");
        if (cutoff?.startsWith("lt.")) {
          const boundary = cutoff.slice(3);
          for (let i = runs.length - 1; i >= 0; i--) {
            if (runs[i].created_at < boundary) runs.splice(i, 1);
          }
        }
        reply(200, []);
        return;
      }
      reply(405, { message: "method not supported" });
    });
  });
  t.after(() => server.close());
  return { server, suites, runs, results };
}

test(
  "POST /api/runs flags latency regressions against the previous run",
  async (t) => {
    const fake = startFakeSupabase(t);
    await new Promise((resolve) =>
      fake.server.listen(0, "127.0.0.1", resolve),
    );
    const upstream = `http://127.0.0.1:${fake.server.address().port}`;
    const origin = await startServer(t, {
      SUPABASE_URL: upstream,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    });

    const post = (label, latencyMs) =>
      fetch(`${origin}/api/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tracecase-token": "test-token",
        },
        body: JSON.stringify({
          suite: "latency-suite",
          label,
          results: [{ caseName: "greet", passed: true, latencyMs }],
        }),
      });

    const baseline = await (await post("baseline", 100)).json();
    assert.equal(baseline.flagged, 0);
    assert.equal(baseline.latencyRegression, 0);

    // Identical passes but 10x latency: the case is latency-regressed.
    const slower = await (await post("10x slower", 1000)).json();
    assert.equal(slower.regressed, 0);
    assert.equal(slower.latencyRegression, 1);
    assert.equal(slower.flagged, 1);
    assert.equal(slower.shouldFail, true);

    // The stored flag surfaces on the run page.
    const page = await fetch(`${origin}/runs/${slower.runId}`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /latency_regression/);

    // Stable latency does not flag.
    const stable = await (await post("stable", 1000)).json();
    assert.equal(stable.latencyRegression, 0);
    assert.equal(stable.flagged, 0);

    // The persisted result row carries the flag.
    const flaggedRow = fake.results.find(
      (row) => row.run_id === slower.runId,
    );
    assert.deepEqual(flaggedRow.flags, ["latency_regression"]);
  },
);

test(
  "dashboard pagination navigates to page 2 when searchParams is awaited",
  async (t) => {
    const fake = startFakeSupabase(t);
    await new Promise((resolve) =>
      fake.server.listen(0, "127.0.0.1", resolve),
    );
    const upstream = `http://127.0.0.1:${fake.server.address().port}`;
    const origin = await startServer(t, {
      SUPABASE_URL: upstream,
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    });

    const suiteId = "00000000-0000-4000-8000-000000000001";
    fake.suites.push({
      id: suiteId,
      name: "pagination-suite",
      description: "Pagination test suite",
      created_at: new Date(1000).toISOString(),
    });

    const baseTime = Date.now();
    for (let i = 1; i <= 15; i++) {
      fake.runs.push({
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        suite_id: suiteId,
        label: `run-${String(i).padStart(2, "0")}`,
        passed: 1,
        total: 1,
        regressed: 0,
        flagged: 0,
        created_at: new Date(baseTime + i * 1000).toISOString(),
      });
    }

    const page1 = await fetch(`${origin}/`);
    assert.equal(page1.status, 200);
    const html1 = await page1.text();
    assert.match(
      html1,
      /Page(?:\s|<!-- -->)*1(?:\s|<!-- -->)*of(?:\s|<!-- -->)*2/,
    );
    assert.match(html1, /run-04/);
    assert.doesNotMatch(html1, /run-01/);

    const page2 = await fetch(`${origin}/?page=2`);
    assert.equal(page2.status, 200);
    const html2 = await page2.text();
    assert.match(
      html2,
      /Page(?:\s|<!-- -->)*2(?:\s|<!-- -->)*of(?:\s|<!-- -->)*2/,
    );
    assert.match(html2, /run-01/);
    assert.doesNotMatch(html2, /run-04/);
  },
);
