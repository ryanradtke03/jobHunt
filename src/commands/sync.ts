import { loadJobs, saveJobs } from "../lib/jobsStore.js";
import { jobIdFor } from "../lib/jobId.js";
import { syncJobToNotion } from "../lib/notion.js";

export interface SyncCliOptions {
  force?: boolean;
}

// Pushes every locally-saved job that doesn't yet have a Notion page —
// backfills jobs saved before Notion sync (and the `id` field) existed, and
// recovers from any per-job failures `find` warned about and skipped.
// With --force, re-pushes every tracked job regardless of notionPageId —
// syncJobToNotion upserts, so this updates existing pages in place (no
// duplicates) rather than skipping them; use it to backfill a property
// added to propertiesFor after jobs were already synced.
export async function sync(options: SyncCliOptions = {}): Promise<void> {
  const jobs = await loadJobs();
  for (const job of jobs) {
    if (!job.id) job.id = jobIdFor(job.link);
  }
  const pending = jobs.filter((job) => job.status !== "ignored" && (options.force || !job.notionPageId));

  if (pending.length === 0) {
    console.log(
      options.force
        ? "No tracked jobs to sync."
        : "Nothing to sync — every tracked job already has a Notion page."
    );
    return;
  }

  let synced = 0;
  for (const job of pending) {
    try {
      job.notionPageId = await syncJobToNotion(job);
      synced++;
    } catch (err) {
      console.warn(`Notion sync failed for ${job.company} — ${job.title}: ${(err as Error).message}`);
    }
  }

  await saveJobs(jobs);
  console.log(`Synced ${synced}/${pending.length} jobs to Notion.`);
}
