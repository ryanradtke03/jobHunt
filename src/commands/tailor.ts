export async function tailor(jobId: string, options: { file?: string }): Promise<void> {
  console.log(`tailor: planned steps for job ${jobId}`);
  console.log("  1. Pull the JD (from the stored URL, or --file override)");
  console.log("  2. Load data/resume-pool.json");
  console.log("  3. Call the Anthropic API to select + lightly reword existing bullets only");
  console.log("  4. Generate .docx + .pdf into output/");
  console.log("  5. Update the job's status to \"tailored\"");
  throw new Error("not implemented");
}
