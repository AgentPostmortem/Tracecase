import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import type { Result, Run } from "@/lib/types";
import { ExplainRun } from "@/components/ExplainRun";

export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { id } = await params;
  const { demo } = await searchParams;
  const supabase = db();

  const { data: run } = await supabase
    .from("tc_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!run) notFound();
  const r = run as Run;

  const { data: results } = await supabase
    .from("tc_results")
    .select("*")
    .eq("run_id", r.id)
    .order("case_name", { ascending: true });

  const { data: prev } = await supabase
    .from("tc_runs")
    .select("id, label, created_at")
    .eq("suite_id", r.suite_id)
    .lt("created_at", r.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let prevPass = new Map<string, boolean>();
  if (prev) {
    const { data: prevResults } = await supabase
      .from("tc_results")
      .select("case_name, passed")
      .eq("run_id", (prev as { id: string }).id);
    prevPass = new Map(
      (prevResults ?? []).map((x: { case_name: string; passed: boolean }) => [
        x.case_name,
        x.passed,
      ]),
    );
  }

  const rows = (results ?? []) as Result[];
  const rate = r.total ? Math.round((r.passed / r.total) * 100) : 0;
  const isDemo = demo === "1";

  const failing = rows
    .filter((x) => !x.passed)
    .map(
      (x) =>
        `${x.case_name}${x.flags.length ? ` [${x.flags.join(", ")}]` : ""}`,
    )
    .join("; ");
  const aiSummary =
    `Run "${r.label}" on ${r.model ?? "n/a"} (prompt ${r.prompt_version ?? "n/a"}): ` +
    `${r.passed}/${r.total} passed, ${r.regressed} regressed, ${r.flagged} flagged. ` +
    `Failing cases: ${failing || "none"}.`;

  return (
    <div className="space-y-6 animate-fade-up">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[13px] text-muted transition hover:text-text"
      >
        ← back to dashboard
      </Link>

      {isDemo && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <span className="mt-0.5 text-accent">✦</span>
          <div className="text-[13px]">
            <div className="font-medium text-text">
              This is the eval run you just triggered.
            </div>
            <div className="mt-0.5 text-muted">
              Tracecase replayed the suite, diffed it against the previous run,
              and flagged anything that regressed below. In real use your CI
              posts this automatically on every prompt or model change.
            </div>
          </div>
        </div>
      )}

      {/* Summary header */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-muted">
              run
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold">{r.label}</h1>
            <p className="mt-1 text-[12px] text-muted">
              {r.model ?? "model n/a"} · prompt {r.prompt_version ?? "n/a"} ·{" "}
              {new Date(r.created_at)
                .toISOString()
                .slice(0, 16)
                .replace("T", " ")}
              {prev
                ? ` · diffed vs "${(prev as { label: string }).label}"`
                : ""}
            </p>
          </div>
          <Gauge rate={rate} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
          <Stat label="passed" value={`${r.passed}/${r.total}`} tone="good" />
          <Stat label="regressed" value={r.regressed} tone="bad" />
          <Stat label="flagged" value={r.flagged} tone="warn" />
          <span
            className={`self-center rounded-md px-2.5 py-1 text-[12px] font-medium ${
              r.regressed > 0 || r.flagged > 0
                ? "bg-bad/12 text-bad"
                : "bg-good/12 text-good"
            }`}
          >
            {r.regressed > 0 || r.flagged > 0
              ? "would fail CI"
              : "would pass CI"}
          </span>
        </div>
      </div>

      <ExplainRun summary={aiSummary} />

      {/* Cases */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Cases</h2>
        <div className="stagger grid gap-3">
          {rows.map((row) => {
            const wasPassing = prevPass.get(row.case_name);
            const regressed = wasPassing === true && !row.passed;
            const fixed = wasPassing === false && row.passed;
            return (
              <div
                key={row.id}
                className={`rounded-2xl border bg-surface p-4 shadow-card ${
                  regressed
                    ? "border-bad/50"
                    : row.passed
                      ? "border-border"
                      : "border-bad/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[14px] font-medium">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        row.passed ? "bg-good" : "bg-bad"
                      }`}
                    />
                    {row.case_name}
                  </span>
                  <span className="flex items-center gap-2 text-[11px]">
                    {regressed && <Tag tone="bad">REGRESSED</Tag>}
                    {fixed && <Tag tone="good">FIXED</Tag>}
                    {row.flags.map((f) => (
                      <Tag key={f} tone="warn">
                        {f}
                      </Tag>
                    ))}
                    <span
                      className={`font-semibold ${
                        row.passed ? "text-good" : "text-bad"
                      }`}
                    >
                      {row.passed ? "PASS" : "FAIL"}
                    </span>
                  </span>
                </div>

                {(row.output || row.expected) && (
                  <div className="mt-3 grid gap-3 text-[12px] sm:grid-cols-2">
                    {row.expected && (
                      <Field label="expected" value={row.expected} />
                    )}
                    {row.output && <Field label="output" value={row.output} />}
                  </div>
                )}

                {row.tool_calls && row.tool_calls.length > 0 && (
                  <div className="mt-3 text-[12px]">
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-muted">
                      tool calls
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {row.tool_calls.map((tc, i) => (
                        <span
                          key={i}
                          className={`rounded-md px-2 py-1 font-mono ${
                            tc.allowed === false
                              ? "bg-bad/12 text-bad"
                              : "bg-bg text-muted"
                          }`}
                        >
                          {tc.name}
                          {tc.allowed === false && " · blocked"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {row.latency_ms != null && (
                  <div className="mt-2 text-[11px] text-muted">
                    {row.latency_ms} ms
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Gauge({ rate }: { rate: number }) {
  const ring = rate === 100 ? "#3fb950" : rate >= 75 ? "#e3a008" : "#f85149";
  const tone =
    rate === 100 ? "text-good" : rate >= 75 ? "text-warn" : "text-bad";
  return (
    <div className="relative grid h-16 w-16 shrink-0 place-items-center">
      <div
        className="h-16 w-16 rounded-full"
        style={{
          background: `conic-gradient(${ring} ${rate * 3.6}deg, rgb(var(--border)) 0deg)`,
        }}
      />
      <div className="absolute grid h-12 w-12 place-items-center rounded-full bg-surface">
        <span className={`text-[14px] font-semibold tabular-nums ${tone}`}>
          {rate}%
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "good" | "bad" | "warn";
}) {
  const toneClass = { good: "text-good", bad: "text-bad", warn: "text-warn" }[
    tone
  ];
  const color = value === 0 || value === "0" ? "text-muted" : toneClass;
  return (
    <span className="rounded-lg border border-border bg-bg px-3 py-1.5">
      <span className={`text-sm font-semibold ${color}`}>{value}</span>{" "}
      <span className="text-[11px] text-muted">{label}</span>
    </span>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "good" | "bad" | "warn";
}) {
  const cls = {
    good: "bg-good/15 text-good",
    bad: "bg-bad/15 text-bad",
    warn: "bg-warn/15 text-warn",
  }[tone];
  return (
    <span className={`rounded px-2 py-0.5 font-medium ${cls}`}>{children}</span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg p-3">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-muted">
        {label}
      </div>
      <div className="whitespace-pre-wrap break-words text-text">{value}</div>
    </div>
  );
}
