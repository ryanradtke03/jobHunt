# Format & Structure

Default layout for the generated resume. These numbers are measured from a real, already-finished one-page resume rather than derived from generic style guidance — use them as-is unless the user attached their own reference resume (in which case measure and match that one instead: its margins, fonts, section order, and skills grouping take priority over everything below).

## Page & margins

- US Letter (8.5 × 11 in).
- Margins: **0.4 in top and bottom, 0.6 in left and right.** Tighter than typical generic resume guidance (often 0.75 in) — this is deliberate, it's what fits a full one-page early-career resume without crowding.
- Single column. No headers/footers, no tables for layout, no text boxes, no graphics/icons — keep it ATS-parseable.

## Fonts

Calibri throughout.

| Element | Size | Weight/style |
|---|---|---|
| Name (header) | 16pt | Bold, centered |
| Contact line | 10.5pt | Regular, centered |
| Section headings | ~11.5pt | Bold, uppercase, bottom border |
| Body text / bullets | 10.5pt | Regular |
| "Technologies:" line | 9pt | Italic, gray (#505050) |

## Section order

**Skills → Experience → Projects → Education.**

This is skills-first even for an early-career/entry-level candidate — many generic resume guides recommend education-first for juniors, but the measured reference resume this is based on puts skills first regardless of experience level, and that's the convention to follow here unless told otherwise.

Section headings: exactly "Skills", "Experience", "Projects", "Education" — bold, uppercase, with a thin bottom border under each, some spacing before/after.

## Contact line

Centered, one line, pipe-separated: `email   |   phone   |   location   |   link1   |   link2 ...`. Any link (GitHub, LinkedIn, portfolio) prints as its `display` text (e.g. `github.com/user`), not the full `url` — but should still be a live hyperlink to the `url`. Omit `phone`/`location` entirely if the pool's contact object doesn't have them, don't print an empty placeholder.

## Experience / Project entry layout

```
Title, Company – Location                                    Mon YYYY – Mon YYYY
  • Bullet one
  • Bullet two
Technologies: Tech1, Tech2, Tech3
```

- Title/company/location bold on the left, dates right-aligned on the same line (tab stop at the right margin).
- Projects (no `company`) drop the ", Company – Location" part, just the title.
- Date range: `formatMonthYear – formatMonthYear`, en dash (–) with spaces on both sides, not a hyphen. A `null` `endDate` reads as "Present". Month abbreviations: Jan, Feb, Mar, Apr, May, June, July, Aug, Sept, Oct, Nov, Dec (no periods).
- Bullets: no trailing period, start with the reworded action-oriented text as selected.
- "Technologies:" line comes after the bullets, once per entry, only if the entry has `technologies` — printed exactly as authored in the pool, smaller/italic/gray per the font table above.

## Skills section — 4 grouped lines

Group selected skills bullets by their `category` field into these 4 display labels (a skills bullet whose `category` maps to a group joins that group's line; skip a group entirely if nothing selected falls into it):

| Display label | `category` values |
|---|---|
| Languages & Frameworks | `language`, `framework` |
| Backend & Data | `library`, `database` |
| Security & Infra | `security`, `infra` |
| Testing & Dev Tools | `testing`, `tool` |

Each present group renders as one line: `Label: item, item, item` (label bold, items plain, comma-separated).

## Education entry layout

Same title/company/dates line as Experience (bold left, dates right-aligned), followed by any bullets the entry has (most will have none — that's normal, print just the header line in that case). Never gated by selection — always print every education entry in the pool.

## Length target

One page for an entry/early-career candidate (0–3 years experience) — be selective in Step 3 of `SKILL.md` rather than including everything, don't shrink fonts/margins below this spec to force a fit. If the pool and the candidate's real experience level clearly indicate more seniority, ask before assuming a 2-page format is wanted.
