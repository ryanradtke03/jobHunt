#!/usr/bin/env node
// Standalone resume renderer — builds a .docx from a resume-pool.json (see
// references/pool-schema.md) and a selection.json ({"selections":[{"bulletId",
// "finalText"}]}), matching this skill's measured layout (see
// references/format-and-structure.md). No dependency on any other project
// file — copy this skill folder anywhere and it still works, as long as the
// `docx` npm package is installed (npm install docx).
//
// Usage: node build_resume.mjs pool.json selection.json output.docx

import { readFile, writeFile } from "node:fs/promises";
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

const FONT_FAMILY = "Calibri";
const FONT_SIZE = { name: 32, heading: 23, body: 21, techLine: 18 }; // half-points
const MARGINS_TWIPS = { top: 576, bottom: 576, left: 864, right: 864 }; // 0.4in / 0.6in
const SECTION_LABELS = { skills: "Skills", experience: "Experience", project: "Projects", education: "Education" };
const SKILLS_GROUPS = [
  { label: "Languages & Frameworks", categories: ["language", "framework"] },
  { label: "Backend & Data", categories: ["library", "database"] },
  { label: "Security & Infra", categories: ["security", "infra"] },
  { label: "Testing & Dev Tools", categories: ["testing", "tool"] },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

function formatMonthYear(iso) {
  if (!iso) return "Present";
  const [year, month] = iso.split("-");
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

function formatDateRange(start, end) {
  if (!start && !end) return "";
  if (!start) return formatMonthYear(end);
  return `${formatMonthYear(start)} – ${formatMonthYear(end)}`;
}

function groupByEntry(selections, entries) {
  const entryIdByBulletId = new Map();
  for (const entry of entries) {
    for (const bullet of entry.bullets) entryIdByBulletId.set(bullet.id, entry.id);
  }
  const grouped = new Map();
  for (const sel of selections) {
    const entryId = entryIdByBulletId.get(sel.bulletId);
    if (!entryId) continue;
    const list = grouped.get(entryId) ?? [];
    list.push(sel);
    grouped.set(entryId, list);
  }
  return grouped;
}

const usableWidthTwips = convertInchesToTwip(8.5) - MARGINS_TWIPS.left - MARGINS_TWIPS.right;

function nameParagraph(contact) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: contact.name, bold: true, size: FONT_SIZE.name, font: FONT_FAMILY })],
  });
}

function contactParagraph(contact) {
  const parts = [new TextRun({ text: contact.email, size: FONT_SIZE.body, font: FONT_FAMILY })];
  const sep = () => parts.push(new TextRun({ text: "   |   ", size: FONT_SIZE.body, font: FONT_FAMILY }));
  if (contact.phone) {
    sep();
    parts.push(new TextRun({ text: contact.phone, size: FONT_SIZE.body, font: FONT_FAMILY }));
  }
  if (contact.location) {
    sep();
    parts.push(new TextRun({ text: contact.location, size: FONT_SIZE.body, font: FONT_FAMILY }));
  }
  for (const link of contact.links ?? []) {
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

function sectionHeading(label) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" } },
    children: [new TextRun({ text: label.toUpperCase(), bold: true, size: FONT_SIZE.heading, font: FONT_FAMILY })],
  });
}

function entryHeaderParagraph(entry) {
  const titleCompany = entry.company
    ? `${entry.title}, ${entry.company}${entry.location ? ` – ${entry.location}` : ""}`
    : entry.title;
  const dateRange = formatDateRange(entry.startDate, entry.endDate);
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: usableWidthTwips }],
    spacing: { before: 140 },
    children: [
      new TextRun({ text: titleCompany, bold: true, size: FONT_SIZE.body, font: FONT_FAMILY }),
      ...(dateRange ? [new TextRun({ text: `\t${dateRange}`, size: FONT_SIZE.body, font: FONT_FAMILY })] : []),
    ],
  });
}

function bulletParagraph(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
    children: [new TextRun({ text, size: FONT_SIZE.body, font: FONT_FAMILY })],
  });
}

function technologiesParagraph(technologies) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "Technologies: ", bold: true, italics: true, size: FONT_SIZE.techLine, font: FONT_FAMILY, color: "505050" }),
      new TextRun({ text: technologies.join(", "), italics: true, size: FONT_SIZE.techLine, font: FONT_FAMILY, color: "505050" }),
    ],
  });
}

function skillsParagraphs(skillsEntry, selectedIds) {
  if (!skillsEntry) return [];
  const chosen = skillsEntry.bullets.filter((b) => selectedIds.has(b.id));
  const bullets = chosen.length > 0 ? chosen : skillsEntry.bullets; // never let the section vanish
  if (chosen.length === 0 && bullets.length > 0) {
    console.warn("Selection contained no skills bullets — falling back to the full skills list.");
  }
  const paragraphs = [sectionHeading(SECTION_LABELS.skills)];
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

function experienceOrProjectParagraphs(section, entries, grouped) {
  const paragraphs = [];
  let headingAdded = false;
  for (const entry of entries) {
    if (entry.section !== section) continue;
    const selected = grouped.get(entry.id) ?? [];
    if (selected.length === 0) continue; // legitimately omit an entry with nothing relevant selected
    if (!headingAdded) {
      paragraphs.push(sectionHeading(SECTION_LABELS[section]));
      headingAdded = true;
    }
    paragraphs.push(entryHeaderParagraph(entry));
    for (const sel of selected) paragraphs.push(bulletParagraph(sel.finalText));
    if (entry.technologies?.length) paragraphs.push(technologiesParagraph(entry.technologies));
  }
  return paragraphs;
}

// Education is never selected — rendered directly from the pool so an entry
// with bullets: [] (a bare degree line) still always appears.
function educationParagraphs(pool) {
  const entries = pool.entries.filter((e) => e.section === "education");
  if (entries.length === 0) return [];
  const paragraphs = [sectionHeading(SECTION_LABELS.education)];
  for (const entry of entries) {
    paragraphs.push(entryHeaderParagraph(entry));
    for (const bullet of entry.bullets) paragraphs.push(bulletParagraph(bullet.text));
  }
  return paragraphs;
}

async function main() {
  const [, , poolPath, selectionPath, outputPath] = process.argv;
  if (!poolPath || !selectionPath || !outputPath) {
    console.error("Usage: node build_resume.mjs pool.json selection.json output.docx");
    process.exit(2);
  }

  const pool = JSON.parse(await readFile(poolPath, "utf-8"));
  const selection = JSON.parse(await readFile(selectionPath, "utf-8"));

  const missingSection = pool.entries.filter((e) => !e.section);
  if (missingSection.length > 0) {
    console.error(`Pool entries missing required "section": ${missingSection.map((e) => e.id).join(", ")}`);
    process.exit(1);
  }

  const selectableEntries = pool.entries.filter((e) => ["experience", "project", "skills"].includes(e.section));
  const grouped = groupByEntry(selection.selections ?? [], selectableEntries);
  const selectedIds = new Set((selection.selections ?? []).map((s) => s.bulletId));

  const children = [
    nameParagraph(pool.contact),
    contactParagraph(pool.contact),
    ...skillsParagraphs(
      selectableEntries.find((e) => e.section === "skills"),
      selectedIds
    ),
    ...experienceOrProjectParagraphs("experience", selectableEntries, grouped),
    ...experienceOrProjectParagraphs("project", selectableEntries, grouped),
    ...educationParagraphs(pool),
  ];

  const doc = new Document({
    sections: [{ properties: { page: { margin: MARGINS_TWIPS } }, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(outputPath, buffer);
  console.log(`Wrote ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
