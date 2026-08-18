#!/usr/bin/env node
import { Command } from "commander";
import { find, type FindCliOptions } from "./commands/find.js";
import { tailor } from "./commands/tailor.js";
import { applied } from "./commands/applied.js";
import { feed } from "./commands/feed.js";
import { sync, type SyncCliOptions } from "./commands/sync.js";

try {
  process.loadEnvFile();
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

const program = new Command();

program.name("jobhunt").description("Find, tailor, and track job applications").version("0.1.0");

program
  .command("find")
  .description("Search target companies for new postings and review keep/ignore")
  .option("--discipline <list>", "comma-separated: frontend,backend,fullstack,qa,infra,mobile,data (overrides search-fields.json)")
  .option("--work-mode <list>", "comma-separated: remote,hybrid,onsite (overrides search-fields.json)")
  .option("--location <list>", "comma-separated free-text location substrings (overrides search-fields.json)")
  .option("--company-size <list>", "comma-separated: startup,small,med,big (overrides search-fields.json)")
  .option(
    "--exclude-seniority <list>",
    "comma-separated: senior,staff,principal,director,executive (overrides search-fields.json)"
  )
  .option("--k <n>", "max total jobs to review this run (overrides search-fields.json, default 20)")
  .option("--yes", "skip interactive review and keep every matched job automatically")
  .action((options: FindCliOptions) => find(options));

program
  .command("tailor <target>")
  .description("Generate a tailored resume for a saved job id or a raw job posting URL")
  .option("--file <path>", "read the job description from a local file instead of the stored URL")
  .option("--discipline <value>", "override the job's inferred discipline: frontend,backend,fullstack,qa,infra,mobile,data")
  .action((target: string, options: { file?: string; discipline?: string }) => tailor(target, options));

program
  .command("applied <job-id>")
  .description("Mark a job as applied and sync to Notion")
  .action(applied);

program
  .command("feed")
  .description("Add new content to the resume pool (not yet speced)")
  .action(feed);

program
  .command("sync")
  .description("Push any locally-saved jobs that don't yet have a Notion page")
  .option("--force", "re-push every tracked job, updating existing Notion pages in place")
  .action((options: SyncCliOptions) => sync(options));

program.parseAsync(process.argv);
