import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const SYSTEM =
  "You are the assistant for Tracecase, a CI / eval harness for AI agents. " +
  "Tracecase records agent test runs, diffs each run against the previous one, " +
  "and flags regressions and unsafe tool calls so CI can block bad prompt or model " +
  "changes before they ship. Answer questions about Tracecase and agent evaluation " +
  "clearly in at most two complete short sentences. Never prefix your answer with " +
  "assistant, a role label, or the product name followed by a colon.";

function cleanReply(reply?: string): string {
  return (reply ?? "")
    .trim()
    .replace(/^(?:assistant|ai|bot|tracecase)\s*:\s*/i, "")
    .trim();
}

type HistoryEntry = { role: "user" | "assistant"; content: string };

function isHistoryEntry(entry: unknown): entry is HistoryEntry {
  if (!entry || typeof entry !== "object") return false;
  const candidate = entry as { role?: unknown; content?: unknown };
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

function validateHistory(history: unknown): HistoryEntry[] | undefined {
  if (history === undefined) return [];
  if (!Array.isArray(history)) return undefined;
  return history.every(isHistoryEntry) ? history : undefined;
}

function fixedReply(prompt: string): string | undefined {
  const question = prompt.trim().toLowerCase().replace(/[?!.,]+$/, "");
  if (/^(hi|hello|hey|hi there|hello there)$/.test(question)) {
    return "Hi! Ask me about Tracecase, agent evals, or how a run gets scored.";
  }
  if (/^(who are you|what are you|what do you do)$/.test(question)) {
    return "I'm the Tracecase assistant. I can explain agent evals, run scoring, regressions, and unsafe tool-call detection.";
  }
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const { prompt, history, max } = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    history?: unknown;
    max?: number;
  };
  if (typeof prompt !== "string" || !prompt) {
    return NextResponse.json(
      { error: "prompt required" },
      { status: 400, headers: CORS },
    );
  }
  const validatedHistory = validateHistory(history);
  if (!validatedHistory) {
    return NextResponse.json(
      {
        error: "invalid history",
        validation: {
          history:
            "must be an array of entries with role 'user' or 'assistant' and string content",
        },
      },
      { status: 400, headers: CORS },
    );
  }

  const fixed = fixedReply(prompt);
  if (fixed) return NextResponse.json({ reply: fixed }, { headers: CORS });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI not configured" },
      { status: 503, headers: CORS },
    );
  }

  const convo = validatedHistory
    .slice(-4)
    .map((m) =>
      `${m.role === "assistant" ? "Previous answer" : "Previous question"}: ${m.content}`,
    )
    .join("\n");
  const full = convo ? `${convo}\nCurrent question: ${prompt}` : prompt;
  const outputMax = Math.min(Math.max(max ?? 140, 32), 220);

  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: full },
        ],
        max_tokens: outputMax,
      }),
    });
    const d = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    return NextResponse.json(
      {
        reply: cleanReply(d.choices?.[0]?.message?.content),
        error: d.error?.message,
      },
      { headers: CORS },
    );
  } catch {
    return NextResponse.json(
      { error: "AI upstream unreachable" },
      { status: 502, headers: CORS },
    );
  }
}
