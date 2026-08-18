export type Discipline = "frontend" | "backend" | "fullstack" | "qa" | "infra" | "mobile" | "data";

export type WorkMode = "remote" | "hybrid" | "onsite";

export type CompanySize = "startup" | "small" | "med" | "big";

export type SeniorityLevel = "senior" | "staff" | "principal" | "director" | "executive";

export interface SearchFields {
  discipline: Discipline[];
  companySize: Partial<Record<CompanySize, boolean>>;
  locations: string[];
  workMode: WorkMode[];
  excludeSeniority: SeniorityLevel[];
  k: number; // assumed: total cap per `find` run, not per company — unconfirmed, see Open Questions
}

export interface Job {
  id: string; // stable, derived from link — used to address a job from the CLI (tailor/applied)
  title: string;
  company: string;
  link: string; // dedupe key
  salary?: string;
  discipline?: Discipline;
  workMode?: WorkMode;
  location?: string;
  seniority?: SeniorityLevel; // undefined = not detected as elevated (junior/mid/unspecified)
  source: string; // "greenhouse" | "lever" | etc
  foundAt: string; // ISO date
  status: "new" | "ignored" | "tailored" | "applied";
  dateApplied?: string; // ISO date, stamped by `applied`
  notionPageId?: string; // set once synced — makes syncJobToNotion an upsert
  description?: string; // plain-text JD, populated at find time from Greenhouse's content field
  resumePath?: string; // path to the latest accepted tailored .docx, written by `tailor` on accept
}

export interface Company {
  name: string;
  ats: "greenhouse" | "lever" | "ashby";
  token: string;
  size: CompanySize;
}

export type ResumeSection = "experience" | "project" | "education" | "skills";

export interface ResumeBullet {
  id: string; // stable, unique across the whole pool — e.g. "qawolf-qa-engineer-ii-b1"
  text: string;
  category?: string; // e.g. "language" | "framework" | "library" | "database" | "security" | "infra" | "testing" | "tool" — meaningful for section:"skills" bullets, grouped for display via resumeFormat's SKILLS_GROUPS
  disciplines?: Discipline[]; // omit = applies to every discipline (e.g. skills, education)
}

export interface ResumeEntry {
  id: string;
  section: ResumeSection; // required — no default; a hand-edit missing this should fail loudly, not guess
  company: string | null;
  title: string;
  location: string | null;
  startDate: string | null; // ISO year-month, or null
  endDate: string | null; // ISO year-month, or null
  bullets: ResumeBullet[];
  technologies?: string[]; // curated per-entry "Technologies:" line — rendered verbatim, never LLM-selected
}

export interface ContactLink {
  label: string; // "GitHub", "LinkedIn", ...
  display: string; // what's printed, e.g. "github.com/user"
  url: string; // actual href
}

export interface Contact {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  links: ContactLink[];
}

export interface ResumePool {
  contact: Contact;
  entries: ResumeEntry[];
}
