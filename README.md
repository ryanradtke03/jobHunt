# jobhunt

A personal CLI that finds open roles at a handful of target companies, lets you review and keep-or-ignore them, tailors a resume from an existing bullet pool for the ones you want to pursue, and tracks status in Notion. Built for one user — no frontend, just the CLI plus Notion as the review/tracking surface.

## Status

Early scaffold. Commands are stubbed (they print their planned steps, then throw `not implemented`) — see `jobhunt-handoff.md` for the full design brief and build order.

## Setup

```
npm install
cp companies.example.json companies.json
cp data/resume-pool.example.json data/resume-pool.json
cp .env.example .env
```

Fill in `.env` (`NOTION_TOKEN`, `NOTION_DB_ID`, `ANTHROPIC_API_KEY`) and edit `companies.json` / `data/resume-pool.json` with your own data — both are gitignored since they hold personal info.

## Usage

```
npm run dev -- find                # search target companies, review keep/ignore
npm run dev -- tailor <job-id>     # generate a tailored resume for a saved job
npm run dev -- applied <job-id>    # mark a job applied, sync to Notion
npm run dev -- feed                # not yet speced
```

Or build once and run the compiled CLI:

```
npm run build
npm start -- find
```

## Project layout

```
src/
  index.ts          # CLI entry (commander)
  commands/          # find, tailor, applied, feed
  lib/
    ats/             # greenhouse, lever adapters
    notion.ts
    resumeGen.ts
  core/
    types.ts         # shared types (Job, Company, ResumeEntry, ...)
data/
  resume-pool.example.json  # tracked template; resume-pool.json is your real, gitignored data
companies.example.json      # tracked template; companies.json is your real, gitignored data
output/              # generated resumes land here, gitignored
```

See `jobhunt-handoff.md` for the full architecture, shared type definitions, target companies/roles, and open questions.
