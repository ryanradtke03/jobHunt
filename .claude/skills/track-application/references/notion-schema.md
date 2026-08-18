# Job Applications — Notion schema reference

Data source ID: `collection://38c6a07b-244a-801b-98cb-000b583f3ba3`

Last confirmed: 2026-08-17. If a write fails on an unknown property, re-fetch the data
source to check whether the schema has changed since this was written.

| Field               | Type                   | Notes                                                                                                                                  |
| ------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Company             | title                  | required                                                                                                                               |
| Role                | text                   |                                                                                                                                        |
| Job Link            | url                    | dedupe key — check before creating                                                                                                     |
| Job ID              | text                   | posting ID extracted from the URL                                                                                                      |
| Source              | select                 | `LinkedIn`, `Company site`, `Referral`, `Recruiter`, `Other`                                                                           |
| ATS Platform        | select                 | `Greenhouse`, `Workday`, `Lever`, `Ashby`, `Other`                                                                                     |
| Location            | text                   | city only, e.g. "San Francisco" — never "Remote"                                                                                       |
| Remote Type         | select                 | `Remote`, `Hybrid`, `Onsite`                                                                                                           |
| Salary Min          | number (dollar format) | plain number, no symbols                                                                                                               |
| Salary Max          | number (dollar format) | plain number, no symbols                                                                                                               |
| Posted Date         | date                   |                                                                                                                                        |
| Tech Stack          | multi-select           | `React`, `TypeScript`, `JavaScript`, `Node.js`, `Python`, `Go`, `Rust`, `PostgreSQL`, `Playwright`, `Docker`, `AWS`, `GraphQL`, `REST` |
| Track               | select                 | `Frontend`, `Backend`, `Fullstack`, `QA`                                                                                               |
| Status              | select                 | `Interested`, `Applied`, `OA/Screen`, `Interview`, `Offer`, `Rejected`, `Withdrawn`, `Ghosted` — default `Interested`                  |
| Applied Date        | date                   | set when Status becomes `Applied`                                                                                                      |
| Next Step Date      | date                   | set manually / by other workflows, not this skill                                                                                      |
| Resume Version Used | text                   | human-readable label only, e.g. "Backend v3" — set when Ryan mentions it                                                               |
| Resume File         | files                  | the actual resume document attached to the row — see "Attaching a resume file" in SKILL.md                                             |
| Contact             | text                   | not filled by this skill                                                                                                               |
| Priority            | select                 | `High`, `Medium`, `Low` — not filled by this skill unless Ryan asks                                                                    |
| Notes               | text                   | not filled by this skill                                                                                                               |
| Job Description     | text                   | clean plain-text copy of the posting body                                                                                              |

## Views

- `Applications` — main table
- `By Status` — board grouped by Status
- `Next Steps` — calendar on Next Step Date
- `Add application` — quick-capture form
