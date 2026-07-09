import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

function Mark() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 18V6m0 12 5-5 4 3 7-8"
          stroke="#0d0c0a"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
  { href: "/api/runs", label: "API (JSON)" },
];

// Desktop: fixed left rail. Mobile: a compact top bar (rendered separately).
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border-soft bg-surface/40 px-4 py-5 md:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <Mark />
        <span className="font-mono text-[15px] font-semibold tracking-tight">
          Tracecase
        </span>
      </Link>

      <div className="mt-2 px-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          builds live
        </span>
      </div>

      <nav className="mt-6 flex flex-col gap-0.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg px-3 py-2 font-mono text-[13px] text-muted transition hover:bg-surface hover:text-text"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex items-center justify-between border-t border-border-soft px-2 pt-4">
        <span className="font-mono text-[10px] text-muted">CI for agents</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function MobileBar() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border-soft bg-bg/80 px-4 py-3 backdrop-blur-md md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <Mark />
        <span className="font-mono text-[14px] font-semibold">Tracecase</span>
      </Link>
      <div className="flex items-center gap-3 font-mono text-[12px] text-muted">
        <Link href="/about" className="hover:text-text">
          About
        </Link>
        <Link href="/help" className="hover:text-text">
          Help
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
