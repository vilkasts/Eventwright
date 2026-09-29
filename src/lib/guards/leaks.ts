import { VALIDATOR_NAME } from "@/config/workflow";
import { escapeRegExp } from "@/lib/text";
import { AGENT_NAMES } from "@/types/workflow";

// Workflow internals that do not belong in the human-facing document.
const LEAK_PATTERNS: readonly RegExp[] = [
  /\b0\d-[a-z-]+\.md\b/g,
  /\bvalidation-(?:domain|final)\.md\b/g,
  /workflow-state\.json/g,
  /approval\.json/g,
  // Hook paths on Windows use backslashes.
  /\bruns[\\/][\w-]+/g,
  /\bmcp__[\w-]+/g,
  /\b(?:open-meteo|holidays):[a-z_]+/g,
  ...[...AGENT_NAMES, VALIDATOR_NAME].map((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "g")),
];

export const findLeaks = (text: string): string[] => [
  ...new Set(LEAK_PATTERNS.flatMap((pattern) => text.match(pattern) ?? [])),
];
