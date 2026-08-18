---
name: track-application
description: Add or update rows in Ryan's "Job Applications" Notion database. Trigger this skill whenever Ryan pastes a job posting URL (Greenhouse, Workday, LinkedIn, Lever, Ashby, or any other job link), asks to "track this job," "add this to my applications," "log this posting," or similar — even if he just drops a bare link with no other text. Also trigger whenever Ryan says he applied to a company or role (e.g. "I applied to Discord," "just applied to the Twitch role," "mark Zillow as applied") so the existing row can be updated rather than duplicated. Always use this skill instead of describing the job posting in chat — the point is to get it into Notion.
---

# Track Application

Fills out Ryan's "Job Applications" Notion database from a job posting link, and updates
existing rows when he reports having applied.

## Notion database reference

- Database page: `Job Application Database` → `Job Applications`
- Data source ID: `collection://38c6a07b-244a-801b-98cb-000b583f3ba3`
- Full field list and types: see `references/notion-schema.md`. Read that file before your
  first write in a session — property names must match exactly or the write will fail.

Use whatever Notion MCP tools are available in this environment (search / fetch / query
data sources / create pages / update page). Always **query the data source first** — never
guess IDs or assume the schema hasn't changed.

## Workflow A: New job link

Triggered by a pasted URL, with or without extra commentary.

### 1. Identify the ATS platform and extract a Job ID from the URL alone

| URL contains                                                                            | ATS Platform | Job ID extraction                                                                        |
| --------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `greenhouse.io`                                                                         | Greenhouse   | numeric ID segment after `/jobs/`                                                        |
| `myworkdayjobs.com`                                                                     | Workday      | trailing token in the slug after the last underscore, e.g. `..._P748929-1` → `P748929-1` |
| `lever.co`                                                                              | Lever        | the UUID at the end of the path                                                          |
| `ashbyhq.com`                                                                           | Ashby        | the UUID at the end of the path                                                          |
| `linkedin.com/jobs/view/<id>`                                                           | Other        | `<id>`                                                                                   |
| `linkedin.com` with a `currentJobId` query param (e.g. a "collections/recommended" URL) | Other        | value of `currentJobId`                                                                  |
| anything else                                                                           | Other        | best guess from the URL, or leave blank                                                  |

Set **Source** to `LinkedIn` only if the link is a linkedin.com URL or Ryan says he found it
there; otherwise leave Source unset unless he tells you.

### 2. Fetch the posting and extract fields

Fetch the URL. Pull out what you can:

- **Company**
- **Role**
- **Location** (city only — do not put "Remote"/"Hybrid" here)
- **Remote Type** — `Remote` / `Hybrid` / `Onsite`, inferred from the posting
- **Salary Min** / **Salary Max** — numbers only, no `$` or commas. If only one figure is
  given, put it in both Min and Max.
- **Posted Date** — if the posting shows one
- **Tech Stack** — scan the JD text for any of the existing multi-select options in
  `references/notion-schema.md` (React, TypeScript, JavaScript, Node.js, Python, Go, Rust,
  PostgreSQL, Playwright, Docker, AWS, GraphQL, REST). Only tag ones actually mentioned.
  Don't invent new option values.
  don't invent new tags. **Note: this database's Notion:notion-create-pages and update-page
  handled multi_select value additions.**
- **Job Description** — a clean plain-text copy of the posting body (strip nav/boilerplate).
  This is for later reference once the posting gets taken down, so keep it substantive
  rather than a stub.

**If the link is a weak source** (e.g. a LinkedIn "collections/recommended" URL, a redirect,
a login-walled page, or anything that doesn't render a real single posting): still try to
extract at least the **Company**. If you can get the company but little else, go ahead and
create the row with what you have, then tell Ryan plainly what's missing and ask if he wants
to fill any of it in (don't block creation on this — just flag it after).

If you truly cannot determine even the company name, ask Ryan before creating anything.

### 3. Guess the Track

Best-effort only — don't ask Ryan about this, just make a call from the title + JD text:

- **Frontend** — react/vue/angular, "frontend"/"front-end", UI, CSS, design systems, a11y
- **Backend** — API, database, distributed systems, infra, "backend"/"back-end", specific
  backend languages/frameworks with no frontend framing
- **Fullstack** — explicitly says "full stack"/"fullstack", or the JD has a real mix of both
  frontend and backend signals
- **QA** — QA, SDET, test automation, "quality engineer", Playwright/Selenium-heavy JDs

If nothing clearly points one way, leave Track blank rather than force a guess.

### 4. Check for a duplicate before creating

Query the data source for a row with the same **Job Link**, or the same **Company** +
**Role**. If one already exists:

- Tell Ryan it's already tracked (share the Status), and ask if he wants you to update it
  instead of creating a duplicate.
- Don't create a second row.

### 5. Create the row

Default **Status** is always `Interested` unless Ryan's message says he already applied (see
Workflow B — in that case do both steps in one go: create the row _and_ set it to Applied).

Leave any field blank rather than guessing when you don't have real signal for it —
especially Salary, Remote Type, and Tech Stack. Don't fabricate numbers.

## Workflow B: "I applied to X"

Triggered when Ryan reports having applied, referencing a company (and optionally a role) —
whether or not that row already exists.

1. Query the data source for a row matching the company name (case-insensitive, fuzzy is
   fine — "twitch" matches "Twitch"). If more than one row matches (e.g. two roles at the
   same company), ask which one he means.
2. If no matching row exists yet, and he gave you a link in the same message, run Workflow A
   first to create it, then continue.
3. Update the row:
   - **Status** → `Applied`
   - **Applied Date** → today
   - **Resume Version Used** → only if Ryan mentions a resume/version in the same message
     (e.g. "applied to Twitch with the backend resume," a filename, or a track name that
     implies a resume variant). Don't ask him for it if he didn't bring it up — just leave
     it blank.
   - **Resume File** → only if Ryan gives you an actual file (a local path, or attaches one
     in the message). See "Attaching a resume file" below. Don't ask him to provide one if
     he didn't — a text label alone is fine.
4. Confirm back with a short summary of what changed.

## Attaching a resume file

`Resume File` is a real Notion Files property — it holds the actual document, not just a
name. Use this whenever Ryan gives you a local file path (e.g. a resume from
`resume-pool`'s output) to attach to a row, either while creating it or when marking it
applied.

This is a two-step upload, since the Notion MCP tool only prepares the upload — it doesn't
send the file itself:

1. Call the Notion file-upload tool (`notion-create-file-upload` or equivalent) with the
   filename, e.g. `RyanRadtke_Resume_Backend_08_15_26.docx`. It returns an `upload_url` and
   `upload_headers`.
2. Send the actual file with `curl`, using the exact headers returned:

   ```bash
   curl -X POST "$UPLOAD_URL" \
     -H "<each header from upload_headers>" \
     -F "file=@/path/to/RyanRadtke_Resume_Backend_08_15_26.docx"
   ```

3. The upload response (or the original file-upload call) gives you a `markdown_source` /
   file reference — pass that as the value for the **Resume File** property when you create
   or update the page.

Notes:

- Files are capped at 20 MiB for this upload flow — resumes are nowhere near that, so this
  should never be a problem.
- If Ryan just says a resume _type_ ("the backend resume") with no path, that's a
  **Resume Version Used** text update, not a file upload — don't go looking for the file
  yourself unless he gives you a path or it's unambiguous from context (e.g. he just
  generated one this session and told you where it landed).

## General notes

- Always re-fetch the data source schema if it's been a while (schema does evolve) rather
  than trusting a stale mental model — see `references/notion-schema.md` for the last known
  state, but confirm before writing if anything seems off.
- Salary fields are numeric — never write a string like `"120000 - 150000"` into Salary Min.
- Never put remote/hybrid/onsite info in the Location field — that's what Remote Type is for.
- Keep confirmations short: after a create or update, tell Ryan the company, role, and
  what got set — not a full field-by-field dump unless he asks.
