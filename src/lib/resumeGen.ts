/**
 * Builds a system prompt from resume format rules plus the full resume
 * pool, calls the Anthropic API to select and lightly reword existing
 * bullets (never invent content), and renders the result to .docx (via
 * `docx`) and .pdf (via LibreOffice headless conversion) in output/.
 */
export async function generateTailoredResume(jobId: string, jdText: string): Promise<{ docxPath: string; pdfPath: string }> {
  throw new Error("not implemented");
}
