// Test helpers that run the real hook scripts as separate processes, the way Claude Code does.
import { spawn, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { artifactPath, outputDirectory } from "@/io/paths";
import { createRun, saveState } from "@/io/state-store";
import { isRecord } from "@/lib/narrow";
import { createInitialState } from "@/lib/state";
import { buildAwaitingApprovalState, PLAN_TEXT } from "@tests/support/approval-fixtures";
import { NOW } from "@tests/support/state-fixtures";
import { useTempProject } from "@tests/support/temp-project";

const HOOKS_DIRECTORY = path.join(process.cwd(), "src", "hooks");
// The run id used by hook tests.
export const RUN = "2026-09-28-lisbon";

// What a hook process returned; `decision` is "deny" when a PreToolUse guard blocked the call.
export type HookResult = { code: number | null; stdout: string; stderr: string; decision: string | null };

// Reads the permission decision from a PreToolUse hook's JSON answer, or null if it allowed the call.
const permissionDecision = (stdout: string): string | null => {
  if (!stdout.trim().startsWith("{")) return null;
  const parsed: unknown = JSON.parse(stdout);
  const output = isRecord(parsed) ? parsed.hookSpecificOutput : null;
  return isRecord(output) && typeof output.permissionDecision === "string" ? output.permissionDecision : null;
};

// The hook runs the same way Claude Code calls it: payload on stdin, answer via stdout/stderr/exit code.
export const runHook = (name: string, payload: unknown): HookResult => {
  const result = spawnSync(process.execPath, ["--import", "tsx", path.join(HOOKS_DIRECTORY, `${name}.ts`)], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env },
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    decision: permissionDecision(result.stdout),
  };
};

// Several hooks at once, like the PostToolUse hooks of one parallel group of agents.
export const runHooksConcurrently = (name: string, payloads: readonly unknown[]): Promise<number[]> =>
  Promise.all(
    payloads.map(
      (payload) =>
        new Promise<number>((resolve) => {
          const child = spawn(process.execPath, ["--import", "tsx", path.join(HOOKS_DIRECTORY, `${name}.ts`)], {
            env: { ...process.env },
          });
          child.on("close", (code) => {
            resolve(code ?? -1);
          });
          child.stdin.end(JSON.stringify(payload));
        }),
    ),
  );

// A fresh project folder with one new run.
export const setupRun = (): void => {
  useTempProject();
  createRun(createInitialState(RUN, NOW));
};

// Puts the run into the "plan checked, waiting for the human" state, with the plan file on disk.
export const prepareAwaitingApproval = (): void => {
  writeFileSync(artifactPath(RUN, "08-event-plan.md"), PLAN_TEXT);
  saveState(buildAwaitingApprovalState(RUN), NOW);
};

// Path of a file in the run's output folder.
export const outputPath = (fileName: string): string => path.join(outputDirectory(RUN), fileName);

// A hook payload for a Write tool call.
export const writePayload = (filePath: string, content: string): unknown => ({
  tool_name: "Write",
  tool_input: { file_path: filePath, content },
});
