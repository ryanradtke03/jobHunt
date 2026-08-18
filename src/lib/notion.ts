import { Client } from "@notionhq/client";
import type { Job } from "../core/types.js";

const STATUS_LABEL: Record<Job["status"], string> = {
  new: "New",
  ignored: "Ignored",
  tailored: "Tailored",
  applied: "Applied",
};

function client(): Client {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set — see .env.example");
  return new Client({ auth: token });
}

function databaseId(): string {
  const id = process.env.NOTION_DB_ID;
  if (!id) throw new Error("NOTION_DB_ID is not set — see .env.example");
  return id;
}

function propertiesFor(job: Job) {
  return {
    Role: { title: [{ text: { content: job.title } }] },
    Company: { rich_text: [{ text: { content: job.company } }] },
    URL: { url: job.link },
    Status: { select: { name: STATUS_LABEL[job.status] } },
    Source: { rich_text: [{ text: { content: job.source } }] },
    DateFound: { date: { start: job.foundAt } },
    ...(job.dateApplied ? { DateApplied: { date: { start: job.dateApplied } } } : {}),
    ...(job.location ? { Location: { rich_text: [{ text: { content: job.location } }] } } : {}),
    ...(job.workMode ? { WorkMode: { select: { name: job.workMode } } } : {}),
    ...(job.discipline ? { Discipline: { select: { name: job.discipline } } } : {}),
    ...(job.resumePath ? { ResumeFile: { rich_text: [{ text: { content: job.resumePath } }] } } : {}),
    JobID: { rich_text: [{ text: { content: job.id } }] },
  };
}

/**
 * Notion database properties: Company, Role, URL, Status
 * (select: New / Ignored / Tailored / Applied / Rejected / Interview),
 * Source, DateFound, DateApplied, Location, WorkMode, Discipline, ResumeFile, JobID.
 *
 * Upserts by `job.notionPageId` — creates a page on first sync, updates it
 * on every sync after. Returns the page id so the caller can persist it.
 */
export async function syncJobToNotion(job: Job): Promise<string> {
  const notion = client();
  const properties = propertiesFor(job);

  if (job.notionPageId) {
    await notion.pages.update({ page_id: job.notionPageId, properties });
    return job.notionPageId;
  }

  const page = await notion.pages.create({
    parent: { database_id: databaseId() },
    properties,
  });
  return page.id;
}
