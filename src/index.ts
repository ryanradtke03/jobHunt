#!/usr/bin/env node
import { Command } from "commander";
import { find } from "./commands/find.js";
import { tailor } from "./commands/tailor.js";
import { applied } from "./commands/applied.js";
import { feed } from "./commands/feed.js";

const program = new Command();

program.name("jobhunt").description("Find, tailor, and track job applications").version("0.1.0");

program
  .command("find")
  .description("Search target companies for new postings and review keep/ignore")
  .action(find);

program
  .command("tailor <job-id>")
  .description("Generate a tailored resume for a saved job")
  .option("--file <path>", "read the job description from a local file instead of the stored URL")
  .action((jobId: string, options: { file?: string }) => tailor(jobId, options));

program
  .command("applied <job-id>")
  .description("Mark a job as applied and sync to Notion")
  .action(applied);

program
  .command("feed")
  .description("Add new content to the resume pool (not yet speced)")
  .action(feed);

program.parseAsync(process.argv);
