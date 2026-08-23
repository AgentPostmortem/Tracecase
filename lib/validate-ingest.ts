export type ValidateIngestResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateIngestPayload(body: unknown): ValidateIngestResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid body" };
  }

  const b = body as {
    suite?: unknown;
    label?: unknown;
    results?: unknown;
  };

  if (typeof b.suite !== "string" || b.suite === "") {
    return { ok: false, error: "suite is required" };
  }

  if (typeof b.label !== "string" || b.label === "") {
    return { ok: false, error: "label is required" };
  }

  if (!Array.isArray(b.results)) {
    return { ok: false, error: "results[] is required" };
  }

  if (b.results.length === 0) {
    return { ok: false, error: "results[] must contain at least one result" };
  }

  return { ok: true };
}
