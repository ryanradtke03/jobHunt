import { createHash } from "node:crypto";

// Deterministic short id from a job's link — stable across runs so a job
// keeps the same id (and thus the same Notion page) forever.
export function jobIdFor(link: string): string {
  return createHash("sha256").update(link).digest("hex").slice(0, 10);
}
