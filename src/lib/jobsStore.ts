import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Job } from "../core/types.js";

const JOBS_PATH = path.join(process.cwd(), "data", "jobs.json");

export async function loadJobs(): Promise<Job[]> {
  try {
    const raw = await readFile(JOBS_PATH, "utf-8");
    return JSON.parse(raw) as Job[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function saveJobs(jobs: Job[]): Promise<void> {
  await mkdir(path.dirname(JOBS_PATH), { recursive: true });
  await writeFile(JOBS_PATH, JSON.stringify(jobs, null, 2) + "\n", "utf-8");
}

export async function appendJobs(newJobs: Job[]): Promise<void> {
  const existing = await loadJobs();
  await saveJobs([...existing, ...newJobs]);
}

export async function loadExistingLinks(): Promise<Set<string>> {
  const jobs = await loadJobs();
  return new Set(jobs.map((job) => job.link));
}
