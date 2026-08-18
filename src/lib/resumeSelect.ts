import Anthropic from "@anthropic-ai/sdk";
import type { Discipline, ResumeEntry } from "../core/types.js";

export interface SelectedBullet {
  bulletId: string;
  finalText: string;
}

export interface ResumeSelection {
  selections: SelectedBullet[];
}

export interface SelectOptions {
  jdText: string;
  entries: ResumeEntry[]; // experience/project/skills entries only — education is never sent
  discipline?: Discipline;
  priorSelection?: ResumeSelection;
  feedback?: string;
  trimFurther?: boolean; // set on the auto page-budget retry in resumeGen.ts
}

const MODEL = "claude-opus-5";
const MAX_RETRIES = 2;

interface PoolBullet {
  entryId: string;
  text: string;
  digits: Set<string>;
}

function digitsOf(text: string): Set<string> {
  return new Set(text.match(/\d+/g) ?? []);
}

function indexPool(entries: ResumeEntry[]): Map<string, PoolBullet> {
  const index = new Map<string, PoolBullet>();
  for (const entry of entries) {
    for (const bullet of entry.bullets) {
      index.set(bullet.id, { entryId: entry.id, text: bullet.text, digits: digitsOf(bullet.text) });
    }
  }
  return index;
}

function buildPoolPrompt(entries: ResumeEntry[]): string {
  return entries
    .map((entry) => {
      const header = `${entry.id} [${entry.section}] ${entry.company ?? ""} — ${entry.title}`.trim();
      const bullets = entry.bullets.map((b) => `  - (${b.id}) ${b.text}`).join("\n");
      return `${header}\n${bullets}`;
    })
    .join("\n\n");
}

function systemPrompt(discipline?: Discipline): string {
  return [
    "You select and lightly reword bullets from a fixed resume bullet pool to best match a job description.",
    "Rules:",
    "- Select only bullets that exist in the pool below, referenced by their exact bulletId.",
    "- You may lightly reword a bullet's phrasing to better match the JD's language, but never invent a company, title, date, technology, or metric that isn't already in that bullet's original text.",
    "- Never introduce or change any number (counts, percentages, durations, etc.) — every digit sequence in your reworded text must already appear in the original bullet text.",
    `- Prefer bullets tagged with the target discipline${discipline ? ` ("${discipline}")` : ""}, but include strong cross-discipline bullets when clearly relevant.`,
    "- Aim for a one-page resume: be selective, not exhaustive — pick the strongest bullets per entry, not all of them.",
    "- For skills entries, select only the individual skill bullets relevant to this JD.",
    '- Respond with ONLY a JSON object of the shape {"selections":[{"bulletId":string,"finalText":string}]}. No prose, no markdown fences.',
  ].join("\n");
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(json)?/i, "").replace(/```$/, "").trim()
    : trimmed;
  return JSON.parse(jsonText);
}

function validateSelection(parsed: unknown, pool: Map<string, PoolBullet>): { valid: SelectedBullet[]; errors: string[] } {
  const selections = (parsed as { selections?: unknown } | null)?.selections;
  if (!Array.isArray(selections)) {
    return { valid: [], errors: ['Response is missing a "selections" array.'] };
  }

  const valid: SelectedBullet[] = [];
  const errors: string[] = [];
  for (const item of selections) {
    const bulletId = (item as { bulletId?: unknown })?.bulletId;
    const finalText = (item as { finalText?: unknown })?.finalText;
    if (typeof bulletId !== "string" || typeof finalText !== "string") {
      errors.push(`Malformed selection entry: ${JSON.stringify(item)}`);
      continue;
    }
    const original = pool.get(bulletId);
    if (!original) {
      errors.push(`bulletId "${bulletId}" does not exist in the pool.`);
      continue;
    }
    const badDigit = [...digitsOf(finalText)].find((d) => !original.digits.has(d));
    if (badDigit) {
      errors.push(`bulletId "${bulletId}": finalText introduces the number "${badDigit}", not present in the original bullet text.`);
      continue;
    }
    valid.push({ bulletId, finalText });
  }
  return { valid, errors };
}

/**
 * Calls Claude to select and lightly reword bullets from `options.entries`
 * for the given JD. Validation is deterministic set-membership + digit-subset
 * checking (see validateSelection) — never fuzzy string matching — so a
 * violation can be named precisely in a corrective retry.
 */
export async function resumeSelect(options: SelectOptions): Promise<ResumeSelection> {
  const client = new Anthropic();
  const pool = indexPool(options.entries);
  const poolText = buildPoolPrompt(options.entries);

  let context = "";
  if (options.feedback) {
    context += `\n\nThe user reviewed a previous draft and gave this feedback — revise the selection accordingly:\n${options.feedback}`;
    if (options.priorSelection) {
      context += `\n\nPrevious selection:\n${JSON.stringify(options.priorSelection)}`;
    }
  }
  if (options.trimFurther) {
    context += "\n\nThe previous selection was too long for one page. Trim further: drop the weakest bullets and favor shorter phrasing.";
  }

  let userPrompt = `Job description:\n${options.jdText}\n\nResume bullet pool:\n${poolText}${context}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt(options.discipline),
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
    const rawText = textBlock?.text ?? "";

    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch {
      userPrompt = `Your previous response was not valid JSON. Respond with ONLY the JSON object described in the instructions — no prose, no markdown fences.\n\n${userPrompt}`;
      continue;
    }

    const { valid, errors } = validateSelection(parsed, pool);
    if (errors.length === 0) {
      return { selections: valid };
    }
    if (attempt === MAX_RETRIES) {
      throw new Error(`Resume selection failed validation after ${MAX_RETRIES} retries:\n${errors.join("\n")}`);
    }
    userPrompt = `Your previous selection had these problems:\n${errors.join("\n")}\n\nCorrect them and respond again with ONLY the JSON object.\n\n${userPrompt}`;
  }

  throw new Error("Resume selection failed unexpectedly.");
}
