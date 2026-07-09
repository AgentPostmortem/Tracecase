import Link from "next/link";

export const metadata = { title: "About: Tracecase" };

function FeatureIcon({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const features = [
  {
    // Record dot: capture everything.
    icon: <FeatureIcon d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Zm0-3.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
    title: "Records every run",
    body: "Inputs, outputs, tool calls, latency and pass/fail for each case in a suite.",
  },
  {
    // Arrows: compare against the previous run.
    icon: <FeatureIcon d="M2 5.5h9.5m0 0L9 3m2.5 2.5L9 8m5 2.5H4.5m0 0L7 8m-2.5 2.5L7 13" />,
    title: "Diffs vs the last run",
    body: "Every run is compared to the previous one to find exactly what changed.",
  },
  {
    // Flag: surface what regressed.
    icon: <FeatureIcon d="M3.5 14V2.5m0 0h8.2l-2 3 2 3H3.5" />,
    title: "Flags regressions",
    body: "Cases that newly fail, hallucinate, or make an unsafe tool call are surfaced.",
  },
  {
    // Block: stop the bad change.
    icon: <FeatureIcon d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM3.8 3.8l8.4 8.4" />,
    title: "Gates the merge",
    body: "Returns shouldFail so your CI blocks a bad prompt or model change.",
  },
];

export default function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 animate-fade-up">
      <section>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-widest text-muted">
          about
        </span>
        <h1 className="gradient-text mt-4 text-balance text-4xl font-semibold tracking-tight">
          Catch agent regressions before your users do.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Teams ship AI agents with no way to know that a prompt tweak or model
          bump quietly broke behavior. The agent still answers, it just answers
          worse, or calls a tool it should not, and they find out in production.
          Tracecase is the test layer that catches it first.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="glass hover-lift rounded-2xl p-5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-[15px] text-bg">
              {f.icon}
            </div>
            <h2 className="mt-3 text-[15px] font-semibold">{f.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {f.body}
            </p>
          </div>
        ))}
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="text-sm font-medium text-muted">How it is built</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Next.js on Cloudflare Workers, a Supabase Postgres backend, and a
          token-protected ingest API. An n8n workflow posts a fresh run every
          hour so the dashboard is always live, and a built-in AI assistant
          explains any run in plain English.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
          {["Next.js", "Cloudflare Workers", "Supabase", "n8n", "Ollama"].map(
            (t) => (
              <span
                key={t}
                className="rounded-md border border-border bg-bg px-2.5 py-1 text-muted"
              >
                {t}
              </span>
            ),
          )}
        </div>
      </section>

      <div className="flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2 text-[13px] font-semibold text-bg"
        >
          Open the dashboard
        </Link>
        <Link
          href="/help"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-[13px] transition hover:border-accent/50"
        >
          Read the docs
        </Link>
      </div>
    </div>
  );
}
