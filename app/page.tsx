import Link from "next/link";
import { db } from "@/lib/supabase";
import type { Run, Suite } from "@/lib/types";
import { DemoButton } from "@/components/DemoButton";

export const dynamic = "force-dynamic";

function pct(passed: number, total: number) {
  if (!total) return 0;
  return Math.round((passed / total) * 100);
}

const PER_PAGE = 12;

export default async function Home({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = db();
  const { data: suites } = await supabase
    .from("tc_suites")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: runs } = await supabase
    .from("tc_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const allRuns = (runs ?? []) as Run[];
  const latestBySuite = new Map<string, Run>();
  const suiteName = new Map<string, string>();
  for (const r of allRuns) {
    if (!latestBySuite.has(r.suite_id)) latestBySuite.set(r.suite_id, r);
  }

  const list = (suites ?? []) as Suite[];
  for (const s of list) suiteName.set(s.id, s.name);
  const totalRuns = allRuns.length;
  const totalRegressions = allRuns.reduce((a, r) => a + r.regressed, 0);
  const totalFlagged = allRuns.reduce((a, r) => a + r.flagged, 0);

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(totalRuns / PER_PAGE));
  const pageRuns = allRuns.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const latestRun = allRuns[0];
  const latestRate = latestRun ? pct(latestRun.passed, latestRun.total) : 0;

  return (
    <div className="space-y-10">
      <section className="grid items-stretch gap-5 animate-fade-up lg:grid-cols-[1.25fr_0.85fr]">
        <div className="glass relative overflow-hidden rounded-2xl p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent/20 blur-3xl sm:-right-24 sm:-top-24 sm:h-64 sm:w-64" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-widest text-muted">
              agent reliability
            </span>
            <h1 className="gradient-text mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-[3rem]">
              CI for your <em className="font-display font-normal not-italic">AI&nbsp;agents</em>.
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
              Every prompt or model change is replayed against your test suites.
              Tracecase diffs the results, then flags regressions and unsafe tool
              calls before they reach production.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <DemoButton />
              <span className="text-[12px] text-muted">
                triggers a sample run, watch it appear below
              </span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <HeroSignal label="Replay runs" value={totalRuns} />
              <HeroSignal label="Suites watched" value={list.length} />
              <HeroSignal label="Latest pass" value={`${latestRate}%`} />
            </div>
          </div>
        </div>

        <div className="glass flex flex-col rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-muted">Latest run</h2>
              <p className="mt-1 font-mono text-[13px] text-text">
                {latestRun?.label ?? "waiting for CI"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              live
            </span>
          </div>
          <div className="mt-6 grid flex-1 place-items-center">
            <Gauge rate={latestRate} size="lg" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
            <div className="rounded-xl border border-border-soft bg-bg/50 p-3">
              <div className="text-muted">Regressions</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-bad">
                {latestRun?.regressed ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-border-soft bg-bg/50 p-3">
              <div className="text-muted">Unsafe calls</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-warn">
                {latestRun?.flagged ?? 0}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 animate-fade-in sm:grid-cols-3">
        <Metric label="Suites" value={list.length} />
        <Metric label="Runs recorded" value={totalRuns} />
        <Metric
          label="Open regressions"
          value={totalRegressions + totalFlagged}
          tone={totalRegressions + totalFlagged > 0 ? "bad" : "good"}
        />
      </section>

      <PassRateChart runs={allRuns} />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Suites</h2>
        {list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="stagger grid gap-3 lg:grid-cols-2">
            {list.map((s) => {
              const run = latestBySuite.get(s.id);
              const rate = run ? pct(run.passed, run.total) : 0;
              return (
                <Link
                  key={s.id}
                  href={run ? `/runs/${run.id}` : "#"}
                  className="group glass hover-lift min-w-0 rounded-2xl p-4 sm:p-5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                      <div className="font-medium">{s.name}</div>
                      {s.description && (
                        <div className="mt-0.5 truncate text-[13px] text-muted">
                          {s.description}
                        </div>
                      )}
                      {run && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
                          <span className="text-muted">latest:</span>
                          <span className="rounded-md bg-bg px-2 py-0.5 font-mono text-text">
                            {run.label}
                          </span>
                          {run.regressed > 0 && (
                            <Pill tone="bad">{run.regressed} regressed</Pill>
                          )}
                          {run.flagged > 0 && (
                            <Pill tone="warn">{run.flagged} flagged</Pill>
                          )}
                          {run.regressed === 0 && run.flagged === 0 && (
                            <Pill tone="good">clean</Pill>
                          )}
                        </div>
                      )}
                    </div>
                    {run && <Gauge rate={rate} />}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {totalRuns > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">Recent runs</h2>
          <div className="glass overflow-hidden rounded-2xl">
            {pageRuns.map((r) => (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3 text-[13px] transition last:border-0 hover:bg-surface-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-text">
                    {r.label}
                  </span>
                  <span className="hidden truncate text-muted sm:inline">
                    {suiteName.get(r.suite_id) ?? ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.regressed > 0 && <Pill tone="bad">{r.regressed} reg</Pill>}
                  {r.flagged > 0 && <Pill tone="warn">{r.flagged} flag</Pill>}
                  <span
                    className={r.passed === r.total ? "text-good" : "text-warn"}
                  >
                    {r.passed}/{r.total}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} />}
        </section>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const linkCls =
    "rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] transition hover:border-accent/50 hover:text-text";
  const disabled = "pointer-events-none opacity-40";
  return (
    <nav className="flex items-center justify-between pt-1 text-muted">
      <a
        href={`/?page=${page - 1}`}
        className={`${linkCls} ${page <= 1 ? disabled : ""}`}
      >
        ← Newer
      </a>
      <span className="text-[12px]">
        Page {page} of {totalPages}
      </span>
      <a
        href={`/?page=${page + 1}`}
        className={`${linkCls} ${page >= totalPages ? disabled : ""}`}
      >
        Older →
      </a>
    </nav>
  );
}

function PassRateChart({ runs }: { runs: Run[] }) {
  const series = [...runs]
    .slice(0, 24)
    .reverse()
    .map((r) => (r.total ? Math.round((r.passed / r.total) * 100) : 0));

  const W = 640;
  const H = 150;
  const P = 14;
  const current = series.length ? series[series.length - 1] : 0;

  let body;
  if (series.length < 2) {
    body = (
      <div className="grid h-[150px] place-items-center text-[13px] text-muted">
        Post a few runs to see the trend (the n8n feeder adds one hourly).
      </div>
    );
  } else {
    const x = (i: number) => P + (i * (W - 2 * P)) / (series.length - 1);
    const y = (v: number) => H - P - (v / 100) * (H - 2 * P - 6);
    const line = series
      .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");
    const area = `${line} L${x(series.length - 1).toFixed(1)} ${H - P} L${x(0).toFixed(1)} ${H - P} Z`;
    body = (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 150 }}>
        <defs>
          <linearGradient id="tcfill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              stopColor="rgb(var(--accent))"
              stopOpacity="0.28"
            />
            <stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75, 100].map((g) => (
          <line
            key={g}
            x1={P}
            x2={W - P}
            y1={y(g)}
            y2={y(g)}
            stroke="rgb(var(--text) / 0.06)"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#tcfill)" className="chart-area" />
        <path
          d={line}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="chart-line"
        />
        <circle
          cx={x(series.length - 1)}
          cy={y(current)}
          fill="rgb(var(--accent))"
          className="dot-pulse"
        />
      </svg>
    );
  }

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted">
            Pass rate · recent runs
          </h2>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {current}%
            </span>
            <span className="text-[12px] text-muted">latest</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          updates hourly
        </span>
      </div>
      {body}
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "bad" ? "text-bad" : tone === "good" ? "text-good" : "text-text";
  return (
    <div className="glass rounded-2xl p-4">
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>
        {value}
      </div>
      <div className="mt-1 text-[12px] text-muted">{label}</div>
    </div>
  );
}

function HeroSignal({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border-soft bg-bg/40 p-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{label}</div>
    </div>
  );
}

function Gauge({ rate, size = "sm" }: { rate: number; size?: "sm" | "lg" }) {
  const tone =
    rate === 100 ? "text-good" : rate >= 75 ? "text-warn" : "text-bad";
  const ring =
    rate === 100
      ? "rgb(var(--good))"
      : rate >= 75
        ? "rgb(var(--warn))"
        : "rgb(var(--bad))";
  const frame = size === "lg" ? "h-32 w-32" : "h-14 w-14";
  const inner = size === "lg" ? "h-24 w-24" : "h-11 w-11";
  const text = size === "lg" ? "text-2xl" : "text-[13px]";
  return (
    <div className={`relative grid shrink-0 place-items-center ${frame}`}>
      <div
        className={`rounded-full ${frame}`}
        style={{
          background: `conic-gradient(${ring} ${rate * 3.6}deg, rgb(var(--border)) 0deg)`,
        }}
      />
      <div className={`absolute grid place-items-center rounded-full bg-surface ${inner}`}>
        <span className={`font-semibold tabular-nums ${tone} ${text}`}>
          {rate}%
        </span>
      </div>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "good" | "bad" | "warn";
}) {
  const cls = {
    good: "bg-good/12 text-good",
    bad: "bg-bad/12 text-bad",
    warn: "bg-warn/12 text-warn",
  }[tone];
  return (
    <span className={`rounded-md px-2 py-0.5 font-medium ${cls}`}>
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm shadow-card">
      <p className="font-medium">No suites yet.</p>
      <p className="mt-1 text-muted">Post your first run from CI (or curl):</p>
      <pre className="mt-3 overflow-x-auto rounded-xl bg-bg p-4 text-xs leading-relaxed text-muted">
        {`curl -X POST "$TRACECASE_URL/api/runs" \\
  -H "x-tracecase-token: $TOKEN" \\
  -H "content-type: application/json" \\
  -d '{ "suite": "refund-agent", "label": "PR #142",
        "results": [ { "caseName": "...", "passed": true } ] }'`}
      </pre>
    </div>
  );
}
