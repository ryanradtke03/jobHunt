# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`jobhunt` is a personal, single-user CLI: it finds open roles at a handful of target companies, lets the user keep-or-ignore each one, tailors a resume from an existing bullet pool for the ones they want to pursue, and tracks status in Notion. No frontend — the CLI plus Notion is the whole review/tracking surface. One package, not a workspace: a core/cli/app split only earns its keep when two binaries share code, and there's only one binary here.

Full design brief (target companies, command specs, open questions) lives in `jobhunt-handoff.md` — read it before making architectural changes.

## Commands

```
npm install                     # install deps
npm run dev -- <command>        # run the CLI via tsx, no build step (e.g. npm run dev -- find)
npm run build                   # tsc -> dist/
npm start -- <command>          # run the compiled CLI from dist/
npx tsc --noEmit                # type-check only
```

There is no test suite and no lint config yet.

### Local setup (not committed)

`companies.json` and `data/resume-pool.json` are gitignored (personal data). Bootstrap them from the tracked templates:

```
cp companies.example.json companies.json
cp data/resume-pool.example.json data/resume-pool.json
cp .env.example .env
```

`.env` needs `NOTION_TOKEN`, `NOTION_DB_ID`, `ANTHROPIC_API_KEY`.

## Architecture

```
src/
  index.ts              # CLI entry — commander, wires commands/* to subcommands
  commands/
    find.ts              # search target companies, review keep/ignore
    tailor.ts             # generate a tailored resume for a saved job
    applied.ts            # mark a job applied, sync to Notion
    feed.ts               # not yet speced — grows data/resume-pool.json over time
  lib/
    ats/
      greenhouse.ts       # fetches + normalizes postings from Greenhouse's public Job Board API
      lever.ts             # stub — no company currently uses Lever
    notion.ts              # syncs a Job to the Notion tracking database
    resumeGen.ts           # calls Anthropic to select/reword resume-pool bullets, renders .docx/.pdf
  core/
    types.ts               # all shared types (Job, Company, SearchFields, ResumeEntry, ResumeBullet, ...)
```

All command implementations in `src/commands/` and all `lib/` functions are currently stubs: each prints its planned steps to stdout, then `throw new Error("not implemented")`. When implementing one for real, keep that print-then-throw pattern for any sibling stubs you don't touch.

### Shared types (`src/core/types.ts`)

Everything else imports from here — extend types in this file rather than redefining shapes locally. Notable shapes:

- `Job.link` is the dedupe key across `find` runs — every reviewed job (kept *and* ignored) must be persisted, or ignored jobs get re-prompted on the next run.
- `Company.ats` is `"greenhouse" | "lever" | "ashby"`, but only the `greenhouse` adapter exists. `find` must skip and warn on any `ats` value with no adapter rather than failing the whole run.
- `ResumeBullet.disciplines` is tagged per-bullet, not per-entry (`ResumeEntry` has no discipline field) — a single job entry can mix bullets relevant to different disciplines (e.g. a fullstack role with backend-only, frontend-only, and cross-cutting bullets). Omitting `disciplines` on a bullet means it applies to every discipline (e.g. a skills line).
- `SearchFields.k` is currently assumed to be a total cap per `find` run, not per company — unconfirmed, see Open Questions in `jobhunt-handoff.md`.

### Job source

Greenhouse's public Job Board API (`boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`) is the only wired-up source — free, public, no auth, but it only returns postings for companies whose token is already known (no criteria-based market-wide search). Indeed/ZipRecruiter/Dice were deliberately ruled out (their public APIs are dead or partner-gated for individual developers). Broader company discovery is an out-of-band manual step (e.g. asking Claude for candidates, then adding them to `companies.json` by hand), not part of the `find` pipeline.

### Data files

- `companies.json` / `companies.example.json` — array of `Company`. The example file is the tracked template.
- `data/resume-pool.json` / `data/resume-pool.example.json` — array of `ResumeEntry`. Real content doesn't exist yet; needs to be built from existing resume documents (see Build Order in `jobhunt-handoff.md`).
- `output/` — generated resumes land here, gitignored.

### Build order (see `jobhunt-handoff.md` for full detail)

1. Consolidate existing resume variants into `data/resume-pool.json` (not started).
2. Build and test `tailor` against a pasted JD before wiring up job search — this is where output quality lives.
3. Build `find` for Stripe/Figma (tokens confirmed live), then Vercel once its token is confirmed.
4. Wire `applied` and full Notion sync last.
