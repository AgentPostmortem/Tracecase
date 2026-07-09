const suite = [
  {
    name: "Greenlite",
    href: "https://greenlite.agentpostmortem.com",
    mark: "G",
    role: "Human approval cockpit",
  },
  {
    name: "Resolvd",
    href: "https://resolvd.agentpostmortem.com",
    mark: "R",
    role: "Support inbox operator",
  },
  {
    name: "Bridgekit",
    href: "https://bridgekit.agentpostmortem.com",
    mark: "B",
    role: "Scoped MCP tools",
  },
  {
    name: "Webhands",
    href: "https://webhands.agentpostmortem.com",
    mark: "W",
    role: "Browser-use agents",
  },
  {
    name: "AgentPostmortem",
    href: "https://agentpostmortem.com",
    mark: "A",
    role: "Failure case studies",
  },
] as const;

export function SuiteLinks() {
  return (
    <section className="rounded-2xl border border-border-soft bg-surface/50 p-4 shadow-[0_18px_60px_-42px_rgba(201,163,92,0.5)]">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[11px] uppercase tracking-widest text-accent">
          Agent operating suite
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Tracecase is the test layer. The surrounding suite helps agents act,
            ask for approval, use tools, operate browsers, and learn from failures.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {suite.map((product) => (
          <a
            key={product.name}
            href={product.href}
            className="group flex min-w-0 items-center gap-3 rounded-xl border border-border-soft bg-bg/45 p-3 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-2"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/10 font-display text-[14px] italic text-accent shadow-lg shadow-black/20 transition group-hover:border-accent/60 group-hover:text-accent-2">
              {product.mark}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-text transition group-hover:text-accent">
                {product.name}
              </div>
              <div className="truncate text-[10px] text-muted">
                {product.role}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
