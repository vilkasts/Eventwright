// Test helpers that run the real workflow CLI as a separate process and prepare run files for it.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { artifactPath } from "@/io/paths";
import { loadState } from "@/io/state-store";
import { isRecord } from "@/lib/narrow";
import type { WorkflowState } from "@/types/workflow";

const CLI_ENTRY = path.join(process.cwd(), "src", "cli", "main.ts");

export type CliResult = { code: number | null; out: string; err: string };

// The CLI runs the same way the coordinator calls it: a separate node + tsx process.
export const runCli = (...args: string[]): CliResult => {
  const result = spawnSync(process.execPath, ["--import", "tsx", CLI_ENTRY, ...args], {
    encoding: "utf8",
    env: { ...process.env },
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
};

// Runs a CLI command and parses its JSON output.
export const cliJson = (...args: string[]): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(runCli(...args).out);
  if (!isRecord(parsed)) throw new Error(`CLI ${args.join(" ")} did not print a JSON object`);
  return parsed;
};

// Creates a run with `wf init` and returns its id.
export const initRun = (slug: string): string => {
  const { runId } = cliJson("init", slug);
  if (typeof runId !== "string") throw new Error("init did not return a runId");
  return runId;
};

// The saved state of a run.
export const readRunState = (runId: string): WorkflowState => loadState(runId);

// Writes an artifact file directly (no hook runs, so the state does not record the write).
export const writeArtifact = (runId: string, fileName: string, text: string): void => {
  writeFileSync(artifactPath(runId, fileName), text);
};

// A complete, valid 01-requirements.md for the given run.
export const requirementsFixture = (runId: string, services = "venue, catering, entertainment, logistics"): string =>
  [
    "# Requirements",
    "## Meta",
    `- Run: ${runId}`,
    "- Agent: requirements-formalizer",
    "## Summary",
    "Birthday dinner for 30 guests.",
    "## Event profile",
    "40th birthday dinner.",
    "## Guests",
    "- Guests: 30",
    "## Date and location",
    "- Date: 2027-06-12",
    "- City: Lisbon, Portugal",
    "## Budget and currency",
    "- Budget: 9000 EUR",
    "## Services needed",
    `- Services: ${services}`,
    "## Constraints",
    "None.",
    "## Clarification log",
    "No clarifications yet.",
    "## Requirements",
    "- R-01 [MUST]: Seat 30 guests.",
    "## Sources",
    "- user-input — original request",
    "## Open questions",
    "None",
  ].join("\n");
