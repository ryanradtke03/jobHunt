import type { Job } from "../core/types.js";

/**
 * Notion database properties: Company, Role, URL, Status
 * (select: New / Tailored / Applied / Rejected / Interview),
 * Source, DateFound, DateApplied, ResumeFile.
 */
export async function syncJobToNotion(job: Job): Promise<void> {
  throw new Error("not implemented");
}
