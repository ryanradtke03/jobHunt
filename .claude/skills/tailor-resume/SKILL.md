---
name: tailor-resume
description: "Use this skill when the user wants to tailor a resume to a specific job posting or job description using a pre-existing, structured bullet pool (not a from-scratch resume build). Triggers include: 'tailor my resume for this job', 'help me apply to a company', 'make me a resume for this job', a pasted job description, or a job posting URL — especially when a resume-pool.json file exists in the working directory or the user offers to point to one. If the user wants a resume built from scratch via an interview about their background, that's a different, more general resume-writing task, not this skill's job — this skill assumes the candidate's bullets already exist in a structured pool and the task is selecting and lightly wording them for one specific job."
---

# Tailor Resume

Selects and lightly rewords bullets from an existing, structured resume bullet pool to match a specific job description — never inventing content, never altering a number — and renders the result as a .docx matching a measured, ATS-safe layout. Iterate with the user in chat until they're satisfied.

This skill is self-contained: its `references/` and `scripts/` files are resolved relative to this skill's own directory, not the project you happen to be running in. It works whether it's living in a project's `.claude/skills/tailor-resume/` or in `~/.claude/skills/tailor-resume/`.

**Before doing anything else, read the reference files in this skill's `references/` directory:**
- `pool-schema.md` — the exact JSON shape the bullet pool must be in
- `format-and-structure.md` — the default resume layout (margins, fonts, section order, skills grouping)
- `rewording-guide.md` — how to phrase the light rewording in Step 3 (weak verbs to avoid, formatting rules, how to actually match the JD's language without fabricating)

## Step 1: Get the bullet pool

This skill bundles real data in its own `resources/` directory: `resources/resume-pool.json` (the candidate's actual bullet pool) and `resources/resume.docx` (their real, already-finished resume — this is what `format-and-structure.md` was measured from). Use these by default — read `resources/resume-pool.json` directly, no need to ask the user for it.

Only fall back to asking if `resources/resume-pool.json` is missing (e.g. this skill folder was shared without its resources, or copied as a template for someone else) — in that case, check the working directory for a `resume-pool.json` next, and only ask the user directly as a last resort, pointing them at `references/pool-schema.md` for the shape.

If the user explicitly provides a *different* pool or reference resume for this conversation (attaches one, or points at a path), use theirs instead of the bundled default for that conversation — but don't discard the bundled `resources/resume-pool.json` as the fallback for next time.

## Step 2: Get the job description

- A pasted URL: fetch it (e.g. with a web-fetch tool if this session has one) and extract the JD text.
- A pasted JD: use it directly.
- Neither: ask for one — a URL or pasted text.

Note the target discipline (frontend / backend / fullstack / QA / infra / mobile / data) from the JD if it's not stated explicitly — this only informs which bullets read as strongest, it doesn't hard-filter anything.

## Step 3: Select and lightly reword bullets

Only from pool entries with `"section"` equal to `"experience"`, `"project"`, or `"skills"`. Never touch `"education"` entries or the pool's `contact` object here — those are structural and handled directly in Step 5, not selected.

Rules, non-negotiable:
- Select the strongest, most JD-relevant bullets per entry — not all of them. Target one page for an entry/early-career candidate, more only if the pool and the candidate's experience level clearly call for it.
- You may lightly reword a bullet's phrasing to better match the JD's language — see `references/rewording-guide.md` for how (weak verbs to avoid, formatting conventions, and how matching the JD's terminology differs from fabricating a fit).
- Never invent a company, title, date, technology, or metric that isn't already present in that exact bullet's original `text`.
- Never introduce or alter any number — counts, percentages, durations, dollar amounts, version numbers, anything. Every digit sequence in your reworded text must already appear in that bullet's original text.
- For the `skills` entry, select only the individual skill bullets relevant to this JD, not the whole list.

Write the selection to a file (e.g. `selection.json` in a scratch/working location) as:

```json
{"selections": [{"bulletId": "...", "finalText": "..."}]}
```

## Step 4: Validate before building — do not skip this

Run, via the shell:

```
python3 scripts/validate_selection.py resources/resume-pool.json selection.json
```

(run from this skill's own directory, or use full paths if you're elsewhere; swap in a different pool path only if Step 1 ended up using a non-default one — and substitute the actual path to the selection file you just wrote). The script checks, deterministically:
1. Every `bulletId` in your selection exists in the pool.
2. Every number in your `finalText` already appears in that bullet's original text.

If it reports any violation, fix exactly the flagged bullets, rewrite `selection.json`, and re-run. Never proceed to Step 5 with an unresolved violation — this is the one check in this whole skill that must never be skipped or rationalized around, because a wrong number on a resume is the failure mode that actually costs an interview.

## Step 5: Build the resume

Read `references/format-and-structure.md` (measured from the bundled `resources/resume.docx` — or measure the user's own attached reference resume instead, if they gave one for this conversation — see Step 1).

Render via the bundled script — it implements the layout in `references/format-and-structure.md` exactly, so don't hand-write docx-building code:

1. Confirm the `docx` npm package is resolvable (e.g. `node -e "require.resolve('docx')"`). If it isn't, install it — `npm install docx` in the current project if this is a Node project with a `package.json`, otherwise in a scratch directory.
2. Run: `node scripts/build_resume.mjs resources/resume-pool.json selection.json output.docx` (run from this skill's own directory, or use full paths if you're elsewhere; swap in a different pool path only if Step 1 ended up using a non-default one).
3. Deliver the resulting `.docx` to the user — attach/send the file directly if this session has a way to do that, don't just print a path if there's a better delivery mechanism available.

What the script does, so you know what to expect from it: header from `contact` verbatim; Skills grouped per the reference's 4 labels (falls back to the full skills list if your selection contained none — never empty); Experience/Projects only for entries with ≥1 selected bullet, each with its pool `technologies` line verbatim; Education always, straight from the pool, entirely bypassing selection (so a bare degree line with no bullets still renders). Section order: Skills → Experience → Projects → Education.

## Step 6: Iterate

Show the user the draft and a short per-entry summary of which bullets were picked (a few lines, not the whole resume re-typed) so they can react without opening the file if they don't want to. Take their feedback — content, wording, length, formatting — in normal conversation, revise (repeating Steps 3–5 as needed, always re-running Step 4's validation on any new or changed selection), and produce an updated draft. Stop when they say it's good.
