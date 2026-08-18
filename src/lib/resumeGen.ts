import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  convertInchesToTwip,
} from "docx";
import type { Contact, Discipline, ResumeEntry, ResumePool } from "../core/types.js";
import {
  FONT_FAMILY,
  FONT_SIZE,
  SECTION_LABELS,
  SKILLS_GROUPS,
  type StyleOverrides,
  estimateWrappedLines,
  formatDateRange,
  pageLineBudget,
  resolveMargins,
} from "./resumeFormat.js";
import { resumeSelect, type ResumeSelection, type SelectedBullet } from "./resumeSelect.js";

const RESUME_POOL_PATH = path.join(process.cwd(), "data", "resume-pool.json");
const OUTPUT_DIR = path.join(process.cwd(), "output");
const MAX_TRIM_RETRIES = 2;

export interface GenerateOptions {
  discipline?: Discipline;
  priorSelection?: ResumeSelection;
  feedback?: string;
  styleOverrides?: StyleOverrides;
}

export interface GenerateResult {
  docxPath: string;
  selection: ResumeSelection;
}

async function loadResumePool(): Promise<ResumePool> {
  const raw = await readFile(RESUME_POOL_PATH, "utf-8");
  const pool = JSON.parse(raw) as ResumePool;
  const missingSection = pool.entries.filter((e) => !e.section);
  if (missingSection.length > 0) {
    throw new Error(
      `data/resume-pool.json entries missing required "section": ${missingSection.map((e) => e.id).join(", ")}`
    );
  }
  return pool;
}

function groupByEntry(selection: SelectedBullet[], entries: ResumeEntry[]): Map<string, SelectedBullet[]> {
  const entryIdByBulletId = new Map<string, string>();
  for (const entry of entries) {
    for (const bullet of entry.bullets) entryIdByBulletId.set(bullet.id, entry.id);
  }
  const grouped = new Map<string, SelectedBullet[]>();
  for (const sel of selection) {
    const entryId = entryIdByBulletId.get(sel.bulletId);
    if (!entryId) continue;
    const list = grouped.get(entryId) ?? [];
    list.push(sel);
    grouped.set(entryId, list);
  }
  return grouped;
}

function estimateSelectionLines(
  pool: ResumePool,
  selectableEntries: ResumeEntry[],
  selection: SelectedBullet[],
  overrides?: StyleOverrides
): number {
  const grouped = groupByEntry(selection, selectableEntries);
  let lines = 2; // name + contact line

  const skillsEntry = selectableEntries.find((e) => e.section === "skills");
  if (skillsEntry) {
    lines += 1; // heading
    const selectedIds = new Set(selection.map((s) => s.bulletId));
    const chosen = skillsEntry.bullets.filter((b) => selectedIds.has(b.id));
    const bullets = chosen.length > 0 ? chosen : skillsEntry.bullets;
    lines += SKILLS_GROUPS.filter((g) => bullets.some((b) => b.category && g.categories.includes(b.category))).length;
  }

  for (const section of ["experience", "project"] as const) {
    let headingCounted = false;
    for (const entry of selectableEntries) {
      if (entry.section !== section) continue;
      const bullets = grouped.get(entry.id) ?? [];
      if (bullets.length === 0) continue;
      if (!headingCounted) {
        lines += 1;
        headingCounted = true;
      }
      lines += 1; // entry header line
      for (const b of bullets) lines += estimateWrappedLines(b.finalText, overrides);
      if (entry.technologies?.length) lines += 1;
    }
  }

  const educationEntries = pool.entries.filter((e) => e.section === "education");
  if (educationEntries.length > 0) {
    lines += 1; // heading
    for (const entry of educationEntries) lines += 1 + entry.bullets.length;
  }

  return lines;
}

function printSelectionPreview(selectableEntries: ResumeEntry[], selection: SelectedBullet[]): void {
  const grouped = groupByEntry(selection, selectableEntries);
  console.log("\n--- Draft preview ---");
  for (const entry of selectableEntries) {
    if (entry.section === "skills") continue;
    const bullets = grouped.get(entry.id) ?? [];
    if (bullets.length === 0) continue;
    console.log(entry.company ? `${entry.company} — ${entry.title}` : entry.title);
    for (const b of bullets) console.log(`  - ${b.finalText}`);
  }
  const skillsEntry = selectableEntries.find((e) => e.section === "skills");
  if (skillsEntry) {
    const selectedIds = new Set(selection.map((s) => s.bulletId));
    const chosen = skillsEntry.bullets.filter((b) => selectedIds.has(b.id));
    const list = chosen.length > 0 ? chosen : skillsEntry.bullets;
    console.log(`Skills: ${list.map((b) => b.text).join(", ")}`);
  }
  console.log("---------------------\n");
}

function usableWidthTwips(overrides?: StyleOverrides): number {
  const margins = resolveMargins(overrides);
  return convertInchesToTwip(8.5) - margins.left - margins.right;
}

function nameParagraph(contact: Contact): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: contact.name, bold: true, size: FONT_SIZE.name, font: FONT_FAMILY })],
  });
}

function contactParagraph(contact: Contact): Paragraph {
  const parts: (TextRun | ExternalHyperlink)[] = [
    new TextRun({ text: contact.email, size: FONT_SIZE.body, font: FONT_FAMILY }),
  ];
  const sep = () => parts.push(new TextRun({ text: "   |   ", size: FONT_SIZE.body, font: FONT_FAMILY }));
  if (contact.phone) {
    sep();
    parts.push(new TextRun({ text: contact.phone, size: FONT_SIZE.body, font: FONT_FAMILY }));
  }
  if (contact.location) {
    sep();
    parts.push(new TextRun({ text: contact.location, size: FONT_SIZE.body, font: FONT_FAMILY }));
  }
  for (const link of contact.links) {
    sep();
    parts.push(
      new ExternalHyperlink({
        link: link.url,
        children: [new TextRun({ text: link.display, size: FONT_SIZE.body, font: FONT_FAMILY })],
      })
    );
  }
  return new Paragraph({ alignment: AlignmentType.CENTER, children: parts });
}

function sectionHeading(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" } },
    children: [new TextRun({ text: label.toUpperCase(), bold: true, size: FONT_SIZE.heading, font: FONT_FAMILY })],
  });
}

function entryHeaderParagraph(entry: ResumeEntry, overrides?: StyleOverrides): Paragraph {
  const titleCompany = entry.company
    ? `${entry.title}, ${entry.company}${entry.location ? ` – ${entry.location}` : ""}`
    : entry.title;
  const dateRange = formatDateRange(entry.startDate, entry.endDate);
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: usableWidthTwips(overrides) }],
    spacing: { before: 140 },
    children: [
      new TextRun({ text: titleCompany, bold: true, size: FONT_SIZE.body, font: FONT_FAMILY }),
      ...(dateRange ? [new TextRun({ text: `\t${dateRange}`, size: FONT_SIZE.body, font: FONT_FAMILY })] : []),
    ],
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
    children: [new TextRun({ text, size: FONT_SIZE.body, font: FONT_FAMILY })],
  });
}

function technologiesParagraph(technologies: string[]): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "Technologies: ", bold: true, italics: true, size: FONT_SIZE.techLine, font: FONT_FAMILY, color: "505050" }),
      new TextRun({ text: technologies.join(", "), italics: true, size: FONT_SIZE.techLine, font: FONT_FAMILY, color: "505050" }),
    ],
  });
}

function skillsParagraphs(skillsEntry: ResumeEntry | undefined, selectedIds: Set<string>): Paragraph[] {
  if (!skillsEntry) return [];
  const chosen = skillsEntry.bullets.filter((b) => selectedIds.has(b.id));
  const bullets = chosen.length > 0 ? chosen : skillsEntry.bullets; // never let the section vanish
  if (chosen.length === 0 && bullets.length > 0) {
    console.warn("Selection returned no skills bullets — falling back to the full skills list.");
  }
  const paragraphs: Paragraph[] = [sectionHeading(SECTION_LABELS.skills)];
  for (const group of SKILLS_GROUPS) {
    const items = bullets.filter((b) => b.category && group.categories.includes(b.category));
    if (items.length === 0) continue;
    paragraphs.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `${group.label}: `, bold: true, size: FONT_SIZE.body, font: FONT_FAMILY }),
          new TextRun({ text: items.map((i) => i.text).join(", "), size: FONT_SIZE.body, font: FONT_FAMILY }),
        ],
      })
    );
  }
  return paragraphs;
}

function experienceOrProjectParagraphs(
  section: "experience" | "project",
  entries: ResumeEntry[],
  grouped: Map<string, SelectedBullet[]>,
  overrides?: StyleOverrides
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let headingAdded = false;
  for (const entry of entries) {
    if (entry.section !== section) continue;
    const selected = grouped.get(entry.id) ?? [];
    if (selected.length === 0) continue; // legitimately omit an entry with nothing relevant selected
    if (!headingAdded) {
      paragraphs.push(sectionHeading(SECTION_LABELS[section]));
      headingAdded = true;
    }
    paragraphs.push(entryHeaderParagraph(entry, overrides));
    for (const sel of selected) paragraphs.push(bulletParagraph(sel.finalText));
    if (entry.technologies?.length) paragraphs.push(technologiesParagraph(entry.technologies));
  }
  return paragraphs;
}

// Education is never sent to resumeSelect and never gated on selection —
// rendered directly from the pool so an entry with bullets: [] (a bare
// degree line) still always appears.
function educationParagraphs(pool: ResumePool, overrides?: StyleOverrides): Paragraph[] {
  const entries = pool.entries.filter((e) => e.section === "education");
  if (entries.length === 0) return [];
  const paragraphs: Paragraph[] = [sectionHeading(SECTION_LABELS.education)];
  for (const entry of entries) {
    paragraphs.push(entryHeaderParagraph(entry, overrides));
    for (const bullet of entry.bullets) paragraphs.push(bulletParagraph(bullet.text));
  }
  return paragraphs;
}

async function nextDraftNumber(jobId: string): Promise<number> {
  let files: string[];
  try {
    files = await readdir(OUTPUT_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 1;
    throw err;
  }
  const prefix = `${jobId}-`;
  const numbers = files
    .filter((f) => f.startsWith(prefix) && f.endsWith(".docx"))
    .map((f) => Number(f.slice(prefix.length, -".docx".length)))
    .filter((n) => Number.isFinite(n));
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

/**
 * Selects bullets for `jdText` via resumeSelect, auto-retries once or twice
 * if the estimated selection overflows one page, then renders a .docx
 * matching data/resume.docx's measured layout (see resumeFormat.ts).
 */
export async function generateTailoredResume(jobId: string, jdText: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  const pool = await loadResumePool();
  const selectableEntries = pool.entries.filter(
    (e) => e.section === "experience" || e.section === "project" || e.section === "skills"
  );

  let selection = await resumeSelect({
    jdText,
    entries: selectableEntries,
    discipline: options.discipline,
    priorSelection: options.priorSelection,
    feedback: options.feedback,
  });

  const budget = pageLineBudget(options.styleOverrides);
  for (let trim = 0; trim < MAX_TRIM_RETRIES && estimateSelectionLines(pool, selectableEntries, selection.selections, options.styleOverrides) > budget; trim++) {
    selection = await resumeSelect({
      jdText,
      entries: selectableEntries,
      discipline: options.discipline,
      priorSelection: selection,
      trimFurther: true,
    });
  }

  printSelectionPreview(selectableEntries, selection.selections);

  const grouped = groupByEntry(selection.selections, selectableEntries);
  const selectedIds = new Set(selection.selections.map((s) => s.bulletId));

  const children: Paragraph[] = [
    nameParagraph(pool.contact),
    contactParagraph(pool.contact),
    ...skillsParagraphs(
      selectableEntries.find((e) => e.section === "skills"),
      selectedIds
    ),
    ...experienceOrProjectParagraphs("experience", selectableEntries, grouped, options.styleOverrides),
    ...experienceOrProjectParagraphs("project", selectableEntries, grouped, options.styleOverrides),
    ...educationParagraphs(pool, options.styleOverrides),
  ];

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: resolveMargins(options.styleOverrides) } },
        children,
      },
    ],
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  const draftNumber = await nextDraftNumber(jobId);
  const docxPath = path.join(OUTPUT_DIR, `${jobId}-${draftNumber}.docx`);
  const buffer = await Packer.toBuffer(doc);
  await writeFile(docxPath, buffer);

  return { docxPath, selection };
}
