import type { ArtifactRules } from "@/types/checks";

const HEAD_SECTIONS = ["Meta", "Summary"];
const TAIL_SECTIONS = ["Sources", "Open questions"];
const SECTION_PREFIX = "## ";
const TITLE_PREFIX = "# ";
const CITATION = /(https?:\/\/\S+|(?:open-meteo|holidays):[a-z_]+|user-input)/;
const PLACEHOLDER = /\b(?:TODO|TBD|FIXME)\b|\?\?\?|<(?:runId|agent name|Artifact title)[^>\n]*>/;
const REQUIREMENT_ID = /\bR-\d{2}\b/g;

const sectionBody = (lines: readonly string[], heading: string): string[] => {
  const start = lines.findIndex((line) => line.trim() === `${SECTION_PREFIX}${heading}`);
  if (start === -1) return [];
  const end = lines.findIndex((line, index) => index > start && line.startsWith(SECTION_PREFIX));
  return lines.slice(start + 1, end === -1 ? lines.length : end);
};

export const extractRequirementIds = (text: string): string[] => [...new Set(text.match(REQUIREMENT_ID) ?? [])].sort();

const sectionIssues = (lines: readonly string[], sections: readonly string[]): string[] => {
  const expected = [...HEAD_SECTIONS, ...sections, ...TAIL_SECTIONS];
  const actual = lines
    .filter((line) => line.startsWith(SECTION_PREFIX))
    .map((line) => line.slice(SECTION_PREFIX.length).trim());
  if (actual.join("|") === expected.join("|")) return [];
  const found = actual.length > 0 ? actual.join(" | ") : "none";
  return [`'##' sections must be exactly, in order: ${expected.join(" | ")}. Found: ${found}.`];
};

const metaIssues = (lines: readonly string[], runId: string, agent: string): string[] => {
  const meta = sectionBody(lines, "Meta").map((line) => line.trim());
  return [`- Run: ${runId}`, `- Agent: ${agent}`]
    .filter((line) => !meta.includes(line))
    .map((line) => `'## Meta' lacks the line '${line}'.`);
};

const hasCitation = (lines: readonly string[]): boolean =>
  sectionBody(lines, "Sources").some((line) => line.trim().startsWith("- ") && CITATION.test(line));

// Детерминированная структурная проверка: пустой массив — артефакт годен.
export const checkArtifact = (text: string, rules: ArtifactRules): string[] => {
  const lines = text.split(/\r?\n/);
  const issues = [...sectionIssues(lines, rules.sections), ...metaIssues(lines, rules.runId, rules.agent)];
  if (!lines[0]?.startsWith(TITLE_PREFIX)) issues.unshift("The first line must be a '# ' title.");
  const missingLines = rules.requiredLines.filter((prefix) => !lines.some((line) => line.trim().startsWith(prefix)));
  issues.push(...missingLines.map((prefix) => `Missing required line starting with '${prefix}'.`));
  if (!hasCitation(lines))
    issues.push("'## Sources' has no citation (URL, open-meteo:<tool>, holidays:<tool> or user-input).");
  if (PLACEHOLDER.test(text)) issues.push("The artifact still contains placeholders (TODO/TBD/???/template <…>).");
  const missing = (rules.requirementIds ?? []).filter((id) => !text.includes(id));
  if (missing.length > 0) issues.push(`Requirements not addressed: ${missing.join(", ")}.`);
  return issues;
};
