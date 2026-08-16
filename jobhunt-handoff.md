# jobhunt — Repo Setup Brief

Handoff doc for a fresh session. This is self-contained — everything decided so far is in here, no other files needed to get started.

## What this is

A personal CLI (`jobhunt`) that finds open roles at a handful of target companies, lets me review and keep-or-ignore them, tailors a resume from an existing data pool for the ones I want to pursue, and tracks status in Notion. Built for one user. No frontend — a CLI plus Notion as the review/tracking surface covers the whole loop.

## Target companies / roles

Stripe, Figma, Linear, Vercel. Software engineer / full-stack / backend / frontend / QA, entry-to-early-career.

## Setup task

Scaffold a Node.js + TypeScript CLI project matching the structure and types below. Command implementations can be stubs for this pass (`find`/`tailor`/`applied`/`feed` each printing their planned steps or throwing "not implemented") — the goal here is the project skeleton, config, and shared types, not working pipelines yet.

## Architecture

One package, not a multi-package workspace. A core/cli/app split only earns its keep when two binaries share code (e.g. a shared core feeding both a CLI and a GUI) — this project has one binary. Folders inside a single package give the same separation without workspace overhead.

```
jobhunt/
  .env.example            # NOTION_TOKEN, NOTION_DB_ID, ANTHROPIC_API_KEY
  companies.json
  data/
    resume-pool.json      # not built yet — placeholder for now
  src/
    index.ts              # CLI entry (commander)
    commands/
      feed.ts              # not yet speced — stub only
      find.ts
      tailor.ts
      applied.ts
    lib/
      ats/
        greenhouse.ts
        lever.ts           # stub, not used yet
      notion.ts
      resumeGen.ts
    core/
      types.ts             # all shared types below
  output/                  # generated resumes land here, gitignored
```

**Libraries**: `commander`, `@notionhq/client`, `@anthropic-ai/sdk`, `docx`.

## Shared types (`src/core/types.ts`)

```typescript
type Discipline = "frontend" | "backend" | "fullstack" | "qa" | "infra" | "mobile" | "data";

type WorkMode = "remote" | "hybrid" | "onsite";

type CompanySize = "startup" | "small" | "med" | "big";

interface SearchFields {
  discipline: Discipline[];
  companySize: Partial<Record<CompanySize, boolean>>;
  locations: string[];
  workMode: WorkMode[];
  k: number; // assumed: total cap per `find` run, not per company — unconfirmed, see Open Questions
}

interface Job {
  title: string;
  company: string;
  link: string;               // dedupe key
  salary?: string;
  discipline?: Discipline;
  workMode?: WorkMode;
  location?: string;
  source: string;              // "greenhouse" | "lever" | etc
  foundAt: string;             // ISO date
  status: "new" | "ignored" | "tailored" | "applied";
}

interface Company {
  name: string;
  ats: "greenhouse" | "lever" | "ashby";
  token: string;
  size: CompanySize;
}
```

## `companies.json` (starting content)

```json
[
  { "name": "Stripe", "ats": "greenhouse", "token": "stripe", "size": "big" },
  { "name": "Figma", "ats": "greenhouse", "token": "figma", "size": "big" },
  { "name": "Vercel", "ats": "greenhouse", "token": "REPLACE_ME", "size": "med" },
  { "name": "Linear", "ats": "ashby", "token": "REPLACE_ME", "size": "startup" }
]
```

Stripe and Figma tokens are confirmed live — `boards-api.greenhouse.io/v1/boards/stripe/jobs` and `.../figma/jobs` both return real postings right now, no auth needed. Vercel's `ats` is a guess and its token is unset. Linear is likely not on Greenhouse at all — the `ashby` adapter doesn't exist yet, so `find` should skip and warn on any `ats` value it has no adapter for, rather than failing.

## Job source: Greenhouse only, for now

Ruled out Indeed/ZipRecruiter/Dice — their public search APIs are dead for individual developers (Indeed's Publisher API was deprecated 2023–2024; what remains is partner-gated). Greenhouse's Job Board API is free, public, no auth — but only returns postings for companies whose token you already have. Open-ended "search by criteria across the whole market" isn't something this API can do, and is deliberately out of scope for `find`. If broader discovery is wanted later, that's a separate occasional step — e.g. asking Claude for companies to consider, reviewed by hand before they're added to `companies.json` — not part of this pipeline.

## Commands

### `find`
1. Load `companies.json`
2. For each company: `GET boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`
3. Normalize each posting into a `Job`
4. Filter against `SearchFields`: `discipline` by title keyword match, `workMode` inferred from location text, `companySize` from the company's static `size` field, `locations` by loose match on location text
5. Cap results at `k` (currently assumed as a total for the whole run, not per company)
6. Dedupe against every existing `Job` in the db by `link`, regardless of status
7. Prompt keep/ignore for each surviving job
8. Save every reviewed job — kept as `status: "new"`, ignored as `status: "ignored"`. Saving ignored jobs is what makes dedupe hold up across runs; skipping this means re-prompting on jobs already dismissed.

### `tailor <job-id>`
Pulls the JD (from the stored URL, or a `--file=jd.txt` override), loads `resume-pool.json`, calls the Anthropic API — system prompt built from resume format rules plus the full resume pool, with an explicit instruction to select and lightly reword only existing bullets, never invent content — generates `.docx` + `.pdf` (via the `docx` package and LibreOffice headless conversion), saves to `output/`, updates the job's status to `tailored`.

### `applied <job-id>`
Flips status to `applied`, stamps the date, syncs to Notion.

### `feed`
Not yet speced. Intended to add new content to `resume-pool.json` as experience grows. Needs its own design pass before building past a stub.

## Notion database

Properties needed: Company, Role, URL, Status (select: New / Tailored / Applied / Rejected / Interview), Source, DateFound, DateApplied, ResumeFile. Needs its own integration token (notion.so/my-integrations) — separate from any Claude.ai-side Notion connector — shared with this specific database.

## Build order

1. Consolidate existing resume variants (several Word doc versions already in Google Drive — Backend-Infra, Frontend, QA, generalist) into `resume-pool.json`. Not started yet.
2. Build and test `tailor` against a pasted JD, no job search wired up yet — this is where output quality actually lives.
3. Build `find` for Stripe and Figma once tailoring is solid; add Vercel once its token's confirmed.
4. Wire `applied` and full Notion sync last.

## Open questions — resolve before treating these as final

- `k`: total cap for the whole `find` run, or per company? Currently assumed total.
- Vercel: confirm `ats` and `token`.
- Linear: confirm it's actually on Ashby, not Greenhouse; build the Ashby adapter before adding it for real.
- `CompanySize` values above (`big`/`med`/`startup`) are rough guesses by employee count and maturity, not confirmed.
- `feed` has no design yet.
- `resume-pool.json` doesn't exist yet — needs to be built from the existing Drive documents before `tailor` can do anything real.
