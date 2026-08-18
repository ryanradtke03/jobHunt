import { createInterface } from "node:readline";
import type { Discipline } from "../core/types.js";
import { resolveTailorTarget } from "../lib/jdFetch.js";
import { loadJobs, saveJobs } from "../lib/jobsStore.js";
import { syncJobToNotion } from "../lib/notion.js";
import { generateTailoredResume, type GenerateOptions } from "../lib/resumeGen.js";
import type { ResumeSelection } from "../lib/resumeSelect.js";

function askFeedback(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Feedback (margins/length/content/etc.), or press Enter to accept: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function tailor(target: string, options: { file?: string; discipline?: string }): Promise<void> {
  const { job, jdText } = await resolveTailorTarget(target, options.file);

  const discipline = (options.discipline as Discipline | undefined) ?? job.discipline;
  let priorSelection: ResumeSelection | undefined;
  let docxPath: string;

  let generateOptions: GenerateOptions = { discipline };
  let result = await generateTailoredResume(job.id, jdText, generateOptions);
  docxPath = result.docxPath;
  priorSelection = result.selection;
  console.log(`Draft: ${docxPath}`);

  while (true) {
    const feedback = await askFeedback();
    if (feedback === "" || feedback.toLowerCase() === "done" || feedback.toLowerCase() === "accept") {
      break;
    }
    generateOptions = { discipline, priorSelection, feedback };
    result = await generateTailoredResume(job.id, jdText, generateOptions);
    docxPath = result.docxPath;
    priorSelection = result.selection;
    console.log(`Draft: ${docxPath}`);
  }

  const jobs = await loadJobs();
  const stored = jobs.find((j) => j.id === job.id);
  if (!stored) {
    console.error(`Job ${job.id} disappeared from data/jobs.json during tailoring — draft saved at ${docxPath}, but status wasn't updated.`);
    return;
  }

  stored.status = "tailored";
  stored.resumePath = docxPath;
  try {
    stored.notionPageId = await syncJobToNotion(stored);
  } catch (err) {
    console.warn(`Notion sync failed: ${(err as Error).message}`);
  }
  await saveJobs(jobs);
  console.log(`Accepted: ${stored.company} — ${stored.title} (${docxPath})`);
}
