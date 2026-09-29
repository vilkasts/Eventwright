// The deterministic structure check of an artifact (`wf check`, `wf lint`): section order, required lines,
// money formats, citations and leftover template placeholders. It checks the form, not whether facts are true.
import { parseMoney } from "@/lib/budget";
import { sectionLines } from "@/lib/sections";
import { escapeRegExp } from "@/lib/text";
import type { ArtifactRules } from "@/types/checks";

// Every artifact starts with these sections and ends with those; its own sections go in between.
const HEAD_SECTIONS = ["Meta", "Summary"];
const TAIL_SECTIONS = ["Sources", "Open questions"];
const SECTION_PREFIX = "## ";
const TITLE_PREFIX = "# ";
// A source line must contain a URL, an MCP tool reference or "user-input".
const CITATION = /(https?:\/\/\S+|(?:open-meteo|holidays):[a-z_]+|user-input)/;
// Text an agent forgot to replace (TODO, ???, or a template token like <runId>).
const PLACEHOLDER = /\b(?:TODO|TBD|FIXME)\b|\?\?\?|<(?:runId|agent name|Artifact title)[^>\n]*>/;
// Requirement ids like R-01, R-12, R-100.
const REQUIREMENT_ID = /\bR-\d{2,}\b/g;
// A draft may leave a value open ("- Budget: unknown"); G1 requires real values later.
const UNKNOWN_VALUE = "unknown";

// The lines of a section, or none if the section is missing.
const sectionBody = (lines: readonly string[], heading: string): string[] => sectionLines(lines, heading) ?? [];

// All requirement ids mentioned in a text, sorted and without duplicates.
export const extractRequirementIds = (text: string): string[] => [...new Set(text.match(REQUIREMENT_ID) ?? [])].sort();

// The "## " headings must be exactly Meta, Summary, <the agent's sections>, Sources, Open questions.
const sectionIssues = (lines: readonly string[], sections: readonly string[]): string[] => {
  const expected = [...HEAD_SECTIONS, ...sections, ...TAIL_SECTIONS];
  const actual = lines
    .filter((line) => line.startsWith(SECTION_PREFIX))
    .map((line) => line.slice(SECTION_PREFIX.length).trim());
  if (actual.join("|") === expected.join("|")) return [];
  const found = actual.length > 0 ? actual.join(" | ") : "none";
  return [`'##' sections must be exactly, in order: ${expected.join(" | ")}. Found: ${found}.`];
};

// The Meta section must name this run and this agent (so an artifact cannot be copied from another run).
const metaIssues = (lines: readonly string[], runId: string, agent: string): string[] => {
  const meta = sectionBody(lines, "Meta").map((line) => line.trim());
  return [`- Run: ${runId}`, `- Agent: ${agent}`]
    .filter((line) => !meta.includes(line))
    .map((line) => `'## Meta' lacks the line '${line}'.`);
};

// True if the Sources section has at least one bullet with a real citation.
const hasCitation = (lines: readonly string[]): boolean =>
  sectionBody(lines, "Sources").some((line) => line.trim().startsWith("- ") && CITATION.test(line));

// G7 parses these lines; a malformed amount must send the artifact's own agent back, not the gate owners.
const moneyIssues = (text: string, labels: readonly string[]): string[] =>
  labels
    .filter((label) => {
      const value = new RegExp(`^\\s*- ${escapeRegExp(label)}:(.*)$`, "m").exec(text)?.[1]?.trim();
      if (value === undefined || value.toLowerCase() === UNKNOWN_VALUE) return false;
      return parseMoney(`- ${label}: ${value}`, label) === null;
    })
    .map(
      (label) =>
        `'- ${label}:' must be '<amount> <CUR>' — digits with an optional '.' decimal part, no thousands ` +
        `separators or symbols (e.g. '- ${label}: 9000 EUR').`,
    );

// Deterministic structure check: an empty array means the artifact is valid.
// Each problem is returned as a sentence the agent can act on in its retry.
export const checkArtifact = (text: string, rules: ArtifactRules): string[] => {
  const lines = text.split(/\r?\n/);
  const issues = [...sectionIssues(lines, rules.sections), ...metaIssues(lines, rules.runId, rules.agent)];
  if (!lines[0]?.startsWith(TITLE_PREFIX)) issues.unshift("The first line must be a '# ' title.");
  const missingLines = rules.requiredLines.filter((prefix) => !lines.some((line) => line.trim().startsWith(prefix)));
  issues.push(...missingLines.map((prefix) => `Missing required line starting with '${prefix}'.`));
  issues.push(...moneyIssues(text, rules.moneyLines ?? []));
  if (!hasCitation(lines))
    issues.push("'## Sources' has no citation (URL, open-meteo:<tool>, holidays:<tool> or user-input).");
  if (PLACEHOLDER.test(text)) issues.push("The artifact still contains placeholders (TODO/TBD/???/template <…>).");
  const missing = (rules.requirementIds ?? []).filter((id) => !text.includes(id));
  if (missing.length > 0) issues.push(`Requirements not addressed: ${missing.join(", ")}.`);
  return issues;
};
