import type { Company, Job } from "../../core/types.js";

/**
 * Fetches postings from a company's Greenhouse job board and normalizes
 * them into Job records. GET boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 */
export async function fetchGreenhouseJobs(company: Company): Promise<Job[]> {
  throw new Error("not implemented");
}
