import { loadJobs, saveJobs } from "../lib/jobsStore.js";
import { syncJobToNotion } from "../lib/notion.js";

export async function applied(jobId: string): Promise<void> {
  const jobs = await loadJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    console.error(`No job found with id "${jobId}". Run "jobhunt sync" and check the JobID column in Notion.`);
    return;
  }

  job.status = "applied";
  job.dateApplied = new Date().toISOString();

  try {
    job.notionPageId = await syncJobToNotion(job);
  } catch (err) {
    console.warn(`Notion sync failed: ${(err as Error).message}`);
  }

  await saveJobs(jobs);
  console.log(`Marked applied: ${job.company} — ${job.title}`);
}
