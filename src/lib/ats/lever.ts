import type { Company, Job } from "../../core/types.js";

/**
 * Stub — no company in companies.json currently uses Lever.
 */
export async function fetchLeverJobs(company: Company): Promise<Job[]> {
  throw new Error("not implemented");
}
