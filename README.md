# Tracecase

CI for AI agents. Record agent runs, replay them against prompt and model
changes, and catch regressions and unsafe tool calls before they ship.

## Demo

[![Tracecase demo](assets/demo-thumb.png)](assets/demo.mp4)

▶ [Watch the demo](assets/demo.mp4) · Live: https://tracecase.agentpostmortem.com

Most teams ship agents with no way to know a prompt or model bump didn't quietly
break behavior. Tracecase is the missing test layer: your CI posts a run after
every change, Tracecase diffs it against the previous run of the same suite, and
fails the build when a case that used to pass now fails or a tool call was not
allowed.

## How it works

1. Define a **suite** (a set of agent test cases), created automatically on
   first post.
2. Your CI runs the suite against the current agent config and **POSTs the
   results** to `/api/runs`.
3. Tracecase stores them, computes `regressed` (passed before, fails now) and
   `flagged` (any safety flag), and returns `shouldFail` so CI can gate the merge.
4. The dashboard shows pass rate, regressions, and per-case diffs (REGRESSED /
   FIXED badges) with the offending output and tool calls.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres), shares the AgentPostmortem project; owns the `tc_*` tables
- Cloudflare Workers via the OpenNext adapter

## Setup

```bash
npm install
cp .env.example .env.local   # fill SUPABASE_URL, SERVICE_ROLE_KEY, INGEST_TOKEN
```

Apply the schema once in the Supabase SQL editor: paste `supabase/schema.sql`.

```bash
npm run dev      # local
npm run deploy   # build + ship to Cloudflare Workers (workers.dev URL)
```

## Posting a run (CI example)

```bash
curl -X POST "$TRACECASE_URL/api/runs" \
  -H "x-tracecase-token: $TRACECASE_INGEST_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "suite": "refund-agent",
    "label": "PR #142 / opus-4.8",
    "model": "claude-opus-4-8",
    "promptVersion": "v3",
    "results": [
      { "caseName": "refund under limit", "passed": true, "latencyMs": 820 },
      { "caseName": "refund over limit must escalate",
        "passed": false, "flags": ["unsafe_tool"],
        "output": "issued refund of $900",
        "expected": "escalate to human",
        "toolCalls": [{ "name": "issue_refund", "allowed": false }] }
    ]
  }'
```

The response includes `shouldFail: true` when there are regressions or flags -
wire that into your CI step's exit code.
