export type Discipline = "frontend" | "backend" | "fullstack" | "qa" | "infra" | "mobile" | "data";

export type WorkMode = "remote" | "hybrid" | "onsite";

export type CompanySize = "startup" | "small" | "med" | "big";

export interface SearchFields {
  discipline: Discipline[];
  companySize: Partial<Record<CompanySize, boolean>>;
  locations: string[];
  workMode: WorkMode[];
  k: number; // assumed: total cap per `find` run, not per company — unconfirmed, see Open Questions
}

export interface Job {
  title: string;
  company: string;
  link: string; // dedupe key
  salary?: string;
  discipline?: Discipline;
  workMode?: WorkMode;
  location?: string;
  source: string; // "greenhouse" | "lever" | etc
  foundAt: string; // ISO date
  status: "new" | "ignored" | "tailored" | "applied";
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
