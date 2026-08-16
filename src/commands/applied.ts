export async function applied(jobId: string): Promise<void> {
  console.log(`applied: planned steps for job ${jobId}`);
  console.log("  1. Flip status to \"applied\"");
  console.log("  2. Stamp the date");
  console.log("  3. Sync to Notion");
  throw new Error("not implemented");
}
