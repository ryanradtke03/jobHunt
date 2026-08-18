import type { Company, Discipline, Job, SeniorityLevel, WorkMode } from "../../core/types.js";
import { stripHtml } from "../html.js";
import { jobIdFor } from "../jobId.js";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  offices?: { name: string }[];
  content: string;
  updated_at: string;
}

interface GreenhouseBoardResponse {
  jobs: GreenhouseJob[];
}

// Ordered most-specific-first; first regex to match a title wins.
const DISCIPLINE_PATTERNS: [Discipline, RegExp][] = [
  ["mobile", /\b(ios|android|mobile|react native)\b/i],
  ["qa", /\b(qa|quality assurance|test(ing)?|sdet)\b/i],
  ["infra", /\b(infra(structure)?|devops|sre|site reliability|platform|cloud)\b/i],
  ["data", /\b(data (engineer|scientist)|analytics|machine learning|ml engineer)\b/i],
  ["fullstack", /\bfull[\s-]?stack\b/i],
  ["frontend", /\b(front[\s-]?end|ui engineer|web engineer)\b/i],
  ["backend", /\b(back[\s-]?end|server[\s-]?side)\b/i],
  // Catch-all: unqualified "Software Engineer"/"SWE"/"SDE" titles (no front/back/full
  // signal) are treated as fullstack rather than left undetected, since generalist SWE
  // postings are the bulk of what these companies list and undetected discipline made
  // them silently disappear from any --discipline filter.
  ["fullstack", /\b(software engineer|swe|sde)\b/i],
];

function inferDiscipline(title: string): Discipline | undefined {
  for (const [discipline, pattern] of DISCIPLINE_PATTERNS) {
    if (pattern.test(title)) return discipline;
  }
  return undefined;
}

const REMOTE_PATTERN = /\bremote\b/i;
const HYBRID_PATTERN = /\bhybrid\b/i;

function inferWorkMode(title: string, locationName: string): WorkMode | undefined {
  if (REMOTE_PATTERN.test(title) || REMOTE_PATTERN.test(locationName)) return "remote";
  if (HYBRID_PATTERN.test(title) || HYBRID_PATTERN.test(locationName)) return "hybrid";
  return undefined;
}

// Ordered most-specific-first; first regex to match a title wins. Titles that
// match none of these are left unclassified (junior/mid/unspecified) rather
// than guessed at.
const SENIORITY_PATTERNS: [SeniorityLevel, RegExp][] = [
  ["executive", /\b(chief|c[a-z]o|vp|vice president|svp|evp|executive|head of)\b/i],
  ["director", /\bdirector\b/i],
  ["principal", /\bprincipal\b/i],
  ["staff", /\bstaff\b/i],
  ["senior", /\b(senior|sr\.?)\b/i],
];

function inferSeniority(title: string): SeniorityLevel | undefined {
  for (const [level, pattern] of SENIORITY_PATTERNS) {
    if (pattern.test(title)) return level;
  }
  return undefined;
}

// Greenhouse sometimes returns location.name: "N/A" (seen on Stripe postings) and puts
// the real location in offices[].name instead — fall back to that when location is unusable.
function resolveLocation(gj: GreenhouseJob): string {
  if (gj.location.name && gj.location.name !== "N/A") return gj.location.name;
  const offices = gj.offices?.map((o) => o.name).filter(Boolean);
  return offices && offices.length > 0 ? offices.join("; ") : gj.location.name;
}

function normalizeGreenhouseJob(gj: GreenhouseJob, company: Company): Job {
  const location = resolveLocation(gj);
  return {
    id: jobIdFor(gj.absolute_url),
    title: gj.title,
    company: company.name,
    link: gj.absolute_url,
    discipline: inferDiscipline(gj.title),
    workMode: inferWorkMode(gj.title, location),
    location,
    seniority: inferSeniority(gj.title),
    source: "greenhouse",
    foundAt: new Date().toISOString(),
    status: "new",
    description: stripHtml(gj.content),
  };
}

/**
 * Fetches postings from a company's Greenhouse job board and normalizes
 * them into Job records. GET boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 */
export async function fetchGreenhouseJobs(company: Company): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Greenhouse fetch failed for ${company.name} (${company.token}): ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as GreenhouseBoardResponse;
  return body.jobs.map((gj) => normalizeGreenhouseJob(gj, company));
}
