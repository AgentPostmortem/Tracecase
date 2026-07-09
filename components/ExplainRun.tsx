"use client";

import { useState } from "react";

export function ExplainRun({ summary }: { summary: string }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setText(null);
    const prompt =
      `Explain this AI agent eval run to an engineer in 2-3 short sentences, ` +
      `then suggest the single most likely cause and a fix. Data:\n${summary}`;
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, max: 220 }),
      });
      const d = (await res.json()) as { reply?: string; error?: string };
      setText(d.reply || `Unavailable (${d.error ?? "?"}).`);
    } catch {
      setText("Network error, please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-2 text-[13px] font-medium text-accent transition hover:bg-accent/15 disabled:opacity-50"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 1.5c.5 2.9 1.8 4.7 4.7 5.2v.6c-2.9.5-4.2 2.3-4.7 5.2h-.6c-.5-2.9-1.8-4.7-4.7-5.2v-.6c2.9-.5 4.2-2.3 4.7-5.2h.6ZM13.2 10.5c.25 1.35.85 2.2 2.2 2.45v.4c-1.35.25-1.95 1.1-2.2 2.45h-.4c-.25-1.35-.85-2.2-2.2-2.45v-.4c1.35-.25 1.95-1.1 2.2-2.45h.4Z" />
        </svg>
        {busy ? "Analyzing run…" : "Explain this run with AI"}
      </button>
      {text && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-4 text-[13.5px] leading-relaxed text-text">
          {text}
        </div>
      )}
    </div>
  );
}
