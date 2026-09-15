import { NextRequest, NextResponse } from "next/server";
import { db, checkIngestToken } from "@/lib/supabase";
import type { IngestPayload } from "@/lib/types";

export const runtime = "nodejs";

// GET is informational so visiting the endpoint in a browser explains usage
// instead of returning a 405.
export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/runs",
    auth: "header x-tracecase-token",
    body: {
      suite: "string (created on first sight)",
      label: "string",
      model: "string (optional)",
      promptVersion: "string (optional)",
      results: [
        {
          caseName: "string",
          passed: "boolean",
          flags: "string[] (optional)",
          output: "string (optional)",
          expected: "string (optional)",
          latencyMs: "number (optional, enables latency regression detection)",
        },
      ],
    },
    validation: { results: "must contain at least one result" },
    returns: {
      ok: true,
      runId: "uuid",
      regressed: 0,
      flagged: 0,
      latencyRegression: 0,
      shouldFail: false,
    },
  });
}

// Median of the reported latencies, or null when no case reported one.
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// POST /api/runs, a CI job posts one run of a suite after a prompt/model change.
// Tracecase upserts the suite, stores every result, diffs against the previous
// run of the same suite, and returns the regression/flag summary so CI can fail
// the build when something regressed.
export async function POST(req: NextRequest) {
  if (!checkIngestToken(req.headers.get("x-tracecase-token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: IngestPayload;
  try {
    body = (await req.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.suite || !body.label || !Array.isArray(body.results)) {
    return NextResponse.json(
      { error: "suite, label and results[] are required" },
      { status: 400 },
    );
  }
  if (body.results.length === 0) {
    return NextResponse.json(
      { error: "results[] must not be empty" },
      { status: 400 },
    );
  }

  if (body.results.length === 0) {
    return NextResponse.json(
      { error: "results[] must not be empty" },
      { status: 400 },
    );
  }

  const supabase = db();

  // Upsert suite by name.
  let suiteId: string;
  const { data: existing } = await supabase
    .from("tc_suites")
    .select("id")
    .eq("name", body.suite)
    .maybeSingle();
  if (existing) {
    suiteId = (existing as { id: string }).id;
  } else {
    const { data: created, error } = await supabase
      .from("tc_suites")
      .insert({ name: body.suite })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json(
        { error: "could not create suite", detail: error?.message },
        { status: 500 },
      );
    }
    suiteId = (created as { id: string }).id;
  }

  // Pull the previous run's per-case pass map for regression diffing.
  const { data: prevRun } = await supabase
    .from("tc_runs")
    .select("id")
    .eq("suite_id", suiteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevPass = new Map<string, boolean>();
  const prevLatency = new Map<string, number>();
  if (prevRun) {
    const { data: prevResults } = await supabase
      .from("tc_results")
      .select("case_name, passed, latency_ms")
      .eq("run_id", (prevRun as { id: string }).id);
    for (const x of prevResults ?? []) {
      prevPass.set(
        (x as { case_name: string }).case_name,
        (x as { passed: boolean }).passed,
      );
      const latency = (x as { latency_ms: number | null }).latency_ms;
      if (latency != null) {
        prevLatency.set((x as { case_name: string }).case_name, latency);
      }
    }
  }

  const total = body.results.length;
  const passed = body.results.filter((r) => r.passed).length;

  // Latency regression: a case is flagged when it is over 3x slower than the
  // previous run, and also when the suite p50 more than doubles (catching
  // uniform slowdowns no single case hits 3x on its own). Cases without a
  // comparable previous latency are never flagged.
  const currentP50 = median(
    body.results.map((r) => r.latencyMs).filter((v): v is number => v != null),
  );
  const prevP50 = median([...prevLatency.values()]);
  const suiteSlow =
    currentP50 != null && prevP50 != null && prevP50 > 0 && currentP50 > prevP50 * 2;

  const latencyFlagged = body.results.map((r) => {
    const prevMs = prevLatency.get(r.caseName);
    if (prevMs == null || prevMs <= 0 || r.latencyMs == null) return false;
    return r.latencyMs > prevMs * 3 || (suiteSlow && r.latencyMs > prevMs);
  });

  const flagged = body.results.filter(
    (r, i) => (r.flags?.length ?? 0) > 0 || latencyFlagged[i],
  ).length;
  const regressed = body.results.filter(
    (r) => prevPass.get(r.caseName) === true && !r.passed,
  ).length;

  const { data: run, error: runErr } = await supabase
    .from("tc_runs")
    .insert({
      suite_id: suiteId,
      label: body.label,
      model: body.model ?? null,
      prompt_version: body.promptVersion ?? null,
      total,
      passed,
      regressed,
      flagged,
    })
    .select("id")
    .single();

  if (runErr || !run) {
    return NextResponse.json(
      { error: "could not create run", detail: runErr?.message },
      { status: 500 },
    );
  }
  const runId = (run as { id: string }).id;

  const rows = body.results.map((r, i) => ({
    run_id: runId,
    case_name: r.caseName,
    input: r.input ?? null,
    output: r.output ?? null,
    expected: r.expected ?? null,
    tool_calls: r.toolCalls ?? null,
    passed: r.passed,
    // Persist the latency regression as a regular flag so the run page and
    // the flagged count surface it without a schema change.
    flags:
      latencyFlagged[i] && !(r.flags ?? []).includes("latency_regression")
        ? [...(r.flags ?? []), "latency_regression"]
        : (r.flags ?? []),
    latency_ms: r.latencyMs ?? null,
  }));
  const latencyRegression = rows.filter((r) =>
    r.flags.includes("latency_regression"),
  ).length;

  const { error: resErr } = await supabase.from("tc_results").insert(rows);
  if (resErr) {
    return NextResponse.json(
      { error: "could not store results", detail: resErr.message },
      { status: 500 },
    );
  }

  // Cap retained history so the demo data plateaus instead of growing forever.
  // Keep the newest CAP runs; their results cascade on delete.
  const CAP = 50;
  const { data: edge } = await supabase
    .from("tc_runs")
    .select("created_at")
    .order("created_at", { ascending: false })
    .range(CAP, CAP);
  const cutoff = (edge as { created_at: string }[] | null)?.[0]?.created_at;
  if (cutoff) {
    await supabase.from("tc_runs").delete().lt("created_at", cutoff);
  }

  return NextResponse.json({
    ok: true,
    runId,
    total,
    passed,
    regressed,
    flagged,
    latencyRegression,
    // CI convention: non-zero regressions or flags should fail the build.
    shouldFail: regressed > 0 || flagged > 0,
  });
}
