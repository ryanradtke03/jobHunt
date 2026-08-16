import { readFile } from "node:fs/promises";
import { createInterface, type Interface } from "node:readline";
import path from "node:path";
import type { Company, CompanySize, Discipline, Job, SearchFields, SeniorityLevel, WorkMode } from "../core/types.js";
import { fetchGreenhouseJobs } from "../lib/ats/greenhouse.js";
import { appendJobs, loadExistingLinks } from "../lib/jobsStore.js";

const DEFAULT_K = 20;
const COMPANIES_PATH = path.join(process.cwd(), "companies.json");
const SEARCH_FIELDS_PATH = path.join(process.cwd(), "search-fields.json");

export interface FindCliOptions {
  discipline?: string;
  workMode?: string;
  location?: string;
  companySize?: string;
  excludeSeniority?: string;
  k?: string;
  yes?: boolean;
}

// Shape of search-fields.json — every field optional, so the file only needs
// to set what you actually want to default.
export interface SearchFieldsFile {
  discipline?: Discipline[];
  workMode?: WorkMode[];
  locations?: string[];
  companySize?: Partial<Record<CompanySize, boolean>>;
  excludeSeniority?: SeniorityLevel[];
  k?: number;
}

function splitList(value?: string): string[] {
  return value
    ? value
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    : [];
}

async function loadSearchFieldsFile(): Promise<SearchFieldsFile> {
  try {
    const raw = await readFile(SEARCH_FIELDS_PATH, "utf-8");
    return JSON.parse(raw) as SearchFieldsFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

// Lowercases every entry, regardless of source (CLI flag or JSON file) — job
// fields are matched in lowercase, so filter values must be normalized the
// same way no matter where they came from.
function normalizeList(values: string[]): string[] {
  return values.map((v) => v.toLowerCase());
}

// A CLI flag, when passed, overrides the matching field in search-fields.json.
// An omitted flag falls back to the file, then to an unfiltered/default value.
export function mergeSearchFields(options: FindCliOptions, fileDefaults: SearchFieldsFile): SearchFields {
  const k = Number(options.k);
  return {
    discipline: normalizeList(
      options.discipline !== undefined ? splitList(options.discipline) : fileDefaults.discipline ?? []
    ) as Discipline[],
    workMode: normalizeList(
      options.workMode !== undefined ? splitList(options.workMode) : fileDefaults.workMode ?? []
    ) as WorkMode[],
    locations: normalizeList(options.location !== undefined ? splitList(options.location) : fileDefaults.locations ?? []),
    companySize:
      options.companySize !== undefined
        ? (Object.fromEntries(splitList(options.companySize).map((size) => [size, true])) as Partial<Record<CompanySize, boolean>>)
        : fileDefaults.companySize ?? {},
    excludeSeniority: normalizeList(
      options.excludeSeniority !== undefined ? splitList(options.excludeSeniority) : fileDefaults.excludeSeniority ?? []
    ) as SeniorityLevel[],
    k: options.k !== undefined && Number.isFinite(k) && k > 0 ? k : fileDefaults.k ?? DEFAULT_K,
  };
}

function matchesFilters(job: Job, company: Company, fields: SearchFields): boolean {
  if (fields.discipline.length > 0 && (!job.discipline || !fields.discipline.includes(job.discipline))) {
    return false;
  }
  if (fields.workMode.length > 0 && (!job.workMode || !fields.workMode.includes(job.workMode))) {
    return false;
  }
  if (fields.locations.length > 0) {
    const haystack = (job.location ?? "").toLowerCase();
    // Word-boundary match, not substring — a bare "us" location filter would otherwise
    // false-positive on "Austin", "Houston", "Russia", etc.
    if (!fields.locations.some((loc) => new RegExp(`\\b${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack))) {
      return false;
    }
  }
  const sizeKeys = Object.keys(fields.companySize) as CompanySize[];
  if (sizeKeys.length > 0 && !fields.companySize[company.size]) return false;
  if (fields.excludeSeniority.length > 0 && job.seniority && fields.excludeSeniority.includes(job.seniority)) {
    return false;
  }
  return true;
}

// Reviews jobs one at a time via rl.question, returning once every job has an
// answer (or the user quits). Deliberately built as one outer promise wrapping
// a plain-callback recursive chain, rather than awaiting rl.question per
// iteration in a loop — on this Node version, awaiting a promise-wrapped
// rl.question() inside a loop stops readline from resuming the input stream
// after the first answer when stdin is piped (repro'd independently of tsx).
function reviewJobs(rl: Interface, jobs: Job[]): Promise<Job[]> {
  return new Promise((resolve) => {
    const reviewed: Job[] = [];
    function next(i: number): void {
      if (i >= jobs.length) {
        resolve(reviewed);
        return;
      }
      const job = jobs[i];
      rl.question(
        `${job.company} — ${job.title} (${job.location ?? "?"})\n${job.link}\nKeep? [y/N/q to stop] `,
        (answer) => {
          const a = answer.trim().toLowerCase();
          if (a === "q") {
            resolve(reviewed);
            return;
          }
          job.status = a === "y" ? "new" : "ignored";
          reviewed.push(job);
          console.log();
          next(i + 1);
        }
      );
    }
    next(0);
  });
}

async function loadCompanies(): Promise<Company[] | undefined> {
  try {
    const raw = await readFile(COMPANIES_PATH, "utf-8");
    return JSON.parse(raw) as Company[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("No companies.json found. Run: cp companies.example.json companies.json");
      return undefined;
    }
    throw err;
  }
}

export async function find(options: FindCliOptions): Promise<void> {
  const fields = mergeSearchFields(options, await loadSearchFieldsFile());

  const companies = await loadCompanies();
  if (!companies) return;

  const matched: Job[] = [];
  for (const company of companies) {
    if (company.ats !== "greenhouse") {
      console.warn(`Skipping ${company.name}: no adapter for ats="${company.ats}"`);
      continue;
    }
    if (!company.token || company.token === "REPLACE_ME") {
      console.warn(`Skipping ${company.name}: placeholder/missing token`);
      continue;
    }
    try {
      const jobs = await fetchGreenhouseJobs(company);
      matched.push(...jobs.filter((job) => matchesFilters(job, company, fields)));
    } catch (err) {
      console.warn(`Skipping ${company.name}: fetch failed — ${(err as Error).message}`);
    }
  }

  const existingLinks = await loadExistingLinks();
  const freshJobs = matched.filter((job) => !existingLinks.has(job.link));

  if (freshJobs.length === 0) {
    console.log("No new matching jobs found.");
    return;
  }

  const capped = freshJobs.slice(0, fields.k);
  if (freshJobs.length > capped.length) {
    console.log(
      `Found ${freshJobs.length} new matches, reviewing first ${capped.length} (--k ${fields.k}). Run again to see more.`
    );
  }

  let reviewed: Job[];
  if (options.yes) {
    reviewed = capped.map((job) => ({ ...job, status: "new" as const }));
    reviewed.forEach((job) => console.log(`${job.company} — ${job.title} (${job.location ?? "?"})`));
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      reviewed = await reviewJobs(rl, capped);
    } finally {
      rl.close();
    }
  }

  if (reviewed.length === 0) {
    console.log("No jobs reviewed — nothing saved.");
    return;
  }

  await appendJobs(reviewed);
  const kept = reviewed.filter((job) => job.status === "new").length;
  console.log(`Saved ${reviewed.length} jobs (${kept} kept, ${reviewed.length - kept} ignored).`);
}
