export async function find(): Promise<void> {
  console.log("find: planned steps");
  console.log("  1. Load companies.json");
  console.log("  2. For each company: GET boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true");
  console.log("     (skip + warn on any `ats` value with no adapter, e.g. ashby)");
  console.log("  3. Normalize each posting into a Job");
  console.log("  4. Filter against SearchFields (discipline, workMode, companySize, locations)");
  console.log("  5. Cap results at k");
  console.log("  6. Dedupe against every existing Job in the db by `link`, regardless of status");
  console.log("  7. Prompt keep/ignore for each surviving job");
  console.log("  8. Save every reviewed job (kept -> \"new\", ignored -> \"ignored\")");
  throw new Error("not implemented");
}
