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
}

export interface Company {
  name: string;
  ats: "greenhouse" | "lever" | "ashby";
  token: string;
  size: CompanySize;
}

export interface ResumeBullet {
  text: string;
  disciplines?: Discipline[]; // omit = applies to every discipline (e.g. skills, education)
}

export interface ResumeEntry {
  id: string;
  company: string | null;
  title: string;
  location: string | null;
  startDate: string | null; // ISO year-month, or null
  endDate: string | null; // ISO year-month, or null
  bullets: ResumeBullet[];
}
