import { createInterface, type Interface } from "node:readline";
import { readFile } from "node:fs/promises";
import type { Job } from "../core/types.js";
import { stripHtml } from "./html.js";
import { jobIdFor } from "./jobId.js";
import { appendJobs, loadJobs } from "./jobsStore.js";

const MIN_JD_LENGTH = 200; // below this, a fetched page is almost always a JS-shell, not real JD text

function isUrl(target: string): boolean {
  return /^https?:\/\//i.test(target);
}

function askLine(rl: Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, (answer) => resolve(answer.trim())));
}

// Reads multi-line pasted text terminated by a lone "END" line, or EOF (Ctrl+D).
function askMultiline(rl: Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    console.log(prompt);
    const lines: string[] = [];
    function cleanup(): void {
      rl.removeListener("line", onLine);
      rl.removeListener("close", onClose);
    }
    function onLine(line: string): void {
      if (line.trim() === "END") {
        cleanup();
        resolve(lines.join("\n"));
        return;
      }
      lines.push(line);
    }
    function onClose(): void {
      cleanup();
      resolve(lines.join("\n"));
    }
    rl.on("line", onLine);
    rl.once("close", onClose);
  });
}

async function fetchJdFromUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const text = stripHtml(await res.text());
    return text.length >= MIN_JD_LENGTH ? text : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves `target` — an existing Job.id, an existing Job's link, or a brand
 * new posting URL — to a Job, creating and persisting a minimal manual Job
 * record when nothing matches. Then resolves the JD text, in order:
 * --file override, stored job.description, a live fetch of the job's link,
 * and finally an interactive paste prompt. Never invents a title, company,
 * or JD text — always asks when it can't get one automatically.
 */
export async function resolveTailorTarget(target: string, fileOverride?: string): Promise<{ job: Job; jdText: string }> {
  const jobs = await loadJobs();
  let job = jobs.find((j) => j.id === target) ?? (isUrl(target) ? jobs.find((j) => j.link === target) : undefined);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!job) {
      if (!isUrl(target)) {
        throw new Error(
          `No job found with id "${target}", and it's not a URL either. Run "jobhunt sync" and check the JobID column in Notion, or pass a job posting URL directly.`
        );
      }
      console.log(`No saved job matches ${target} — treating it as a new manual entry.`);
      const company = await askLine(rl, "Company name: ");
      const title = await askLine(rl, "Job title: ");
      job = {
        id: jobIdFor(target),
        title,
        company,
        link: target,
        source: "manual",
        foundAt: new Date().toISOString(),
        status: "new",
      };
      await appendJobs([job]);
    }

    let jdText: string | undefined;
    if (fileOverride) {
      // Explicit user intent — trust it even if short, never fall through to the paste prompt.
      jdText = (await readFile(fileOverride, "utf-8")).trim();
    } else {
      const stored = job.description?.trim();
      jdText = stored && stored.length >= MIN_JD_LENGTH ? stored : await fetchJdFromUrl(job.link);
      if (!jdText || jdText.length < MIN_JD_LENGTH) {
        jdText = await askMultiline(
          rl,
          "Couldn't get a usable job description automatically. Paste it below, then type END on its own line (or press Ctrl+D):"
        );
      }
    }

    if (!jdText || jdText.trim().length === 0) {
      throw new Error("No job description available — can't tailor a resume without one.");
    }

    return { job, jdText: jdText.trim() };
  } finally {
    rl.close();
  }
}
