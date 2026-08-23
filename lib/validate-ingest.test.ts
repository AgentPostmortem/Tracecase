import { test } from "node:test";
import assert from "node:assert/strict";
import { validateIngestPayload } from "./validate-ingest.ts";

test("rejects an empty results array", () => {
  const result = validateIngestPayload({
    suite: "smoke",
    label: "run",
    results: [],
  });

  assert.equal(result.ok, false);
  assert.equal(
    (result as { ok: false; error: string }).error,
    "results[] must contain at least one result",
  );
});

test("rejects missing results array", () => {
  const result = validateIngestPayload({
    suite: "smoke",
    label: "run",
  });

  assert.equal(result.ok, false);
  assert.equal(
    (result as { ok: false; error: string }).error,
    "results[] is required",
  );
});

test("accepts a non-empty results array", () => {
  const result = validateIngestPayload({
    suite: "smoke",
    label: "run",
    results: [{ caseName: "case-1", passed: true }],
  });

  assert.equal(result.ok, true);
});
