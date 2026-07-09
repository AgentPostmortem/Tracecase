"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  async function run() {
    setState("running");
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      const data = (await res.json()) as { runId?: string };
      setState("done");
      // Take the visitor straight to the run they just produced, with a banner
      // explaining what it is, so the action has a clear, understandable result.
      if (data.runId) {
        router.push(`/runs/${data.runId}?demo=1`);
      } else {
        router.refresh();
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      onClick={run}
      disabled={state === "running"}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-accent to-accent-2 px-4 py-2 text-[13px] font-semibold text-bg transition hover:opacity-90 disabled:opacity-60"
    >
      {state === "running" ? (
        <>
          <Spinner /> Running eval…
        </>
      ) : state === "done" ? (
        "Run recorded ✓"
      ) : (
        <>
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M2.5 1.7a.6.6 0 0 1 .9-.52l7 4.3a.6.6 0 0 1 0 1.04l-7 4.3a.6.6 0 0 1-.9-.52V1.7Z" />
          </svg>
          Run a demo eval
        </>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
