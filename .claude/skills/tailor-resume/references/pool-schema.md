# Resume Pool JSON Schema

The bullet pool is a single JSON object with two top-level keys: `contact` and `entries`.

```typescript
{
  contact: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    links: { label: string; display: string; url: string }[];
  };
  entries: {
    id: string;                                              // stable, unique per entry
    section: "experience" | "project" | "education" | "skills"; // REQUIRED on every entry
    company: string | null;                                  // null for projects/skills
    title: string;
    location: string | null;
    startDate: string | null;                                // "YYYY-MM", or null
    endDate: string | null;                                   // "YYYY-MM", or null (open-ended reads as "Present")
    technologies?: string[];                                  // curated per-entry "Technologies:" line — printed verbatim, never selected/reworded
    bullets: {
      id: string;         // stable, unique across the WHOLE pool, e.g. "acme-swe-intern-b1"
      text: string;       // the original, factual bullet — this is the only source of truth
      category?: string;  // meaningful only on "skills" entries — see below
      disciplines?: string[]; // e.g. ["backend","frontend"] — informational, doesn't hard-filter
    }[];
  }[];
}
```

## `section` — required, no default

Every entry must declare its `section`. There is deliberately no inference rule (e.g. "`company` is set → must be a job") — a school project with a company-like structure, or an education entry that happens to have `company` set, both break a guessed rule. If an entry is missing `section`, ask the user to add it rather than guessing.

- `"experience"` — paid or structured work (jobs, internships, capstones with an employer-like structure).
- `"project"` — self-directed or academic projects, `company` is usually `null`.
- `"skills"` — exactly one entry, typically titled "Skills", holding the full skill inventory as individual bullets.
- `"education"` — degrees. Rendered directly from the pool, never selected from — see `SKILL.md` Step 5. A `bullets: []` education entry (no coursework/honors listed) is normal and still renders its degree line.

## `category` on skills bullets

Only meaningful on bullets belonging to a `"skills"`-section entry. Used to group the skills line for display — see `format-and-structure.md` for the 4 display groups and which `category` values map to each. Typical values: `"language"`, `"framework"`, `"library"`, `"database"`, `"security"`, `"infra"`, `"testing"`, `"tool"`. A skills bullet without a `category` still gets selected/deselected normally, it just won't land in any of the 4 grouped lines — ask the user for a category if one is missing and needed.

## `technologies` on experience/project entries

A short, curated list of technology names for that entry's "Technologies:" line — e.g. `["React", "Node.js", "PostgreSQL"]`. This is authored data, not generated: print it exactly as given whenever the entry has at least one selected bullet. Never invent or trim this list.

## Bullet `id` stability

Every bullet's `id` must be unique across the *entire* pool (not just within its entry) — selection JSON in Step 3 references bullets by this id alone, and validation (Step 4) looks the bullet up by id to check both that it exists and that no new numbers were introduced. A reasonable convention: `entryId-b1`, `entryId-b2`, and so on.

## Minimal example (placeholder data, not a real person)

```json
{
  "contact": {
    "name": "Jane Example",
    "email": "jane@example.com",
    "phone": "(555) 555-5555",
    "location": "Austin, TX",
    "links": [
      { "label": "GitHub", "display": "github.com/janeexample", "url": "https://github.com/janeexample" }
    ]
  },
  "entries": [
    {
      "id": "acme-swe-intern",
      "section": "experience",
      "company": "Acme Corp",
      "title": "Software Engineer Intern",
      "location": "Remote",
      "startDate": "2025-05",
      "endDate": "2025-08",
      "technologies": ["TypeScript", "React", "Node.js", "Redis"],
      "bullets": [
        {
          "id": "acme-swe-intern-b1",
          "text": "Built a REST API endpoint that reduced average response time by 40% by adding a Redis cache layer",
          "disciplines": ["backend"]
        }
      ]
    },
    {
      "id": "skills-summary",
      "section": "skills",
      "company": null,
      "title": "Skills",
      "location": null,
      "startDate": null,
      "endDate": null,
      "bullets": [
        { "id": "skills-summary-b1", "text": "TypeScript", "category": "language" },
        { "id": "skills-summary-b2", "text": "React", "category": "framework" }
      ]
    },
    {
      "id": "education-acme-university",
      "section": "education",
      "company": "Acme University",
      "title": "B.S. Computer Science",
      "location": "Austin, TX",
      "startDate": null,
      "endDate": "2025-05",
      "bullets": []
    }
  ]
}
```
