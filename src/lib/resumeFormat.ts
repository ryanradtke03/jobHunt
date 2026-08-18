import type { ResumeSection } from "../core/types.js";

// Every number below is measured directly from data/resume.docx (the user's real,
// already-finished master resume) rather than re-derived from the generic
// resume-builder-skill guide — the two disagree on margins, and the real file wins.

export const FONT_FAMILY = "Calibri";

// docx (and OOXML) express font size in half-points.
export const FONT_SIZE = {
  name: 32, // 16pt
  heading: 23, // 11.5pt
  body: 21, // 10.5pt
  techLine: 18, // 9pt
} as const;

// Twips (1/1440 inch) — measured from <w:pgMar> in data/resume.docx.
export const MARGINS_TWIPS = {
  top: 576, // 0.4in
  bottom: 576, // 0.4in
  left: 864, // 0.6in
  right: 864, // 0.6in
};

export const MARGIN_BOUNDS_IN = { min: 0.3, max: 1.0 };
export const BODY_FONT_FLOOR_PT = 10;

// 13pt line height, "exact" rule — spacing.line is in twentieths of a point.
export const LINE_HEIGHT_TWENTIETHS = 260;
export const LINE_HEIGHT_PT = 13;

export const SECTION_ORDER: ResumeSection[] = ["skills", "experience", "project", "education"];

export const SECTION_LABELS: Record<ResumeSection, string> = {
  skills: "Skills",
  experience: "Experience",
  project: "Projects",
  education: "Education",
};

// Maps the pool's fine-grained ResumeBullet.category to the 4 display groups
// observed in data/resume.docx's Skills section.
export const SKILLS_GROUPS: { label: string; categories: string[] }[] = [
  { label: "Languages & Frameworks", categories: ["language", "framework"] },
  { label: "Backend & Data", categories: ["library", "database"] },
  { label: "Security & Infra", categories: ["security", "infra"] },
  { label: "Testing & Dev Tools", categories: ["testing", "tool"] },
];

export interface StyleOverrides {
  marginsIn?: { top?: number; bottom?: number; left?: number; right?: number };
  bodyFontSizePt?: number;
}

export function resolveMargins(overrides?: StyleOverrides): { top: number; bottom: number; left: number; right: number } {
  const clampIn = (inches: number): number =>
    Math.min(MARGIN_BOUNDS_IN.max, Math.max(MARGIN_BOUNDS_IN.min, inches)) * 1440;
  const m = overrides?.marginsIn;
  return {
    top: m?.top !== undefined ? clampIn(m.top) : MARGINS_TWIPS.top,
    bottom: m?.bottom !== undefined ? clampIn(m.bottom) : MARGINS_TWIPS.bottom,
    left: m?.left !== undefined ? clampIn(m.left) : MARGINS_TWIPS.left,
    right: m?.right !== undefined ? clampIn(m.right) : MARGINS_TWIPS.right,
  };
}

export function resolveBodyFontSize(overrides?: StyleOverrides): number {
  const pt = overrides?.bodyFontSizePt ?? FONT_SIZE.body / 2;
  return Math.max(BODY_FONT_FLOOR_PT, pt) * 2;
}

// US Letter is 11in tall; usable width for wrapping estimates is 8.5in minus margins.
const PAGE_HEIGHT_IN = 11;
const PAGE_WIDTH_IN = 8.5;
const CHARS_PER_INCH = 14; // rough Calibri 10.5pt figure, good enough for a trim heuristic

export function pageLineBudget(overrides?: StyleOverrides): number {
  const margins = resolveMargins(overrides);
  const usableHeightIn = PAGE_HEIGHT_IN - (margins.top + margins.bottom) / 1440;
  return Math.floor((usableHeightIn * 72) / LINE_HEIGHT_PT);
}

export function charsPerLine(overrides?: StyleOverrides): number {
  const margins = resolveMargins(overrides);
  const usableWidthIn = PAGE_WIDTH_IN - (margins.left + margins.right) / 1440;
  return Math.max(40, Math.floor(usableWidthIn * CHARS_PER_INCH));
}

// Rough wrapped-line estimate for a single line of text — not a real layout
// engine, just enough signal to catch "this selection is clearly over a page."
export function estimateWrappedLines(text: string, overrides?: StyleOverrides): number {
  return Math.max(1, Math.ceil(text.length / charsPerLine(overrides)));
}

export function formatMonthYear(iso: string | null): string {
  if (!iso) return "Present";
  const [year, month] = iso.split("-");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  const idx = Number(month) - 1;
  return `${MONTHS[idx] ?? month} ${year}`;
}

export function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return "";
  if (!startDate) return formatMonthYear(endDate);
  return `${formatMonthYear(startDate)} – ${formatMonthYear(endDate)}`;
}
