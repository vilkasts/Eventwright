import assert from "node:assert/strict";
import { test } from "node:test";

import { stateIntegrityViolation } from "@/lib/guards/state-integrity";
import { parseHookInput } from "@/lib/hook-input";

const RUN = "2026-09-28-lisbon";
const violation = (payload: unknown): string | null => stateIntegrityViolation(parseHookInput(payload));
const write = (file: string): unknown => ({ tool_name: "Write", tool_input: { file_path: file, content: "{}" } });
const bash = (command: string): unknown => ({ tool_name: "Bash", tool_input: { command } });

test("blocks direct writes to state and approval files, including Windows paths", () => {
  assert.match(violation(write(`/p/runs/${RUN}/workflow-state.json`)) ?? "", /workflow-state\.json/);
  assert.match(violation(write(`C:\\p\\runs\\${RUN}\\approval.json`)) ?? "", /approval\.json/);
});

test("allows ordinary artifact writes", () => {
  assert.equal(violation(write(`/p/runs/${RUN}/artifacts/03-venues.md`)), null);
});

test("allows the workflow CLI and blocks other shell access to state", () => {
  assert.equal(violation(bash(`npm run -s wf -- next ${RUN}`)), null);
  assert.notEqual(violation(bash(`echo {} > runs/${RUN}/workflow-state.json`)), null);
  assert.notEqual(violation(bash(`cat runs/${RUN}/approval.json`)), null);
});

test("protected names match case-insensitively and include temporary files (F03)", () => {
  const edit = (file: string): unknown => ({ tool_name: "Edit", tool_input: { file_path: file, new_string: "{}" } });
  const multiEdit = (file: string): unknown => ({ tool_name: "MultiEdit", tool_input: { file_path: file, edits: [] } });
  assert.notEqual(violation(write(`C:\\p\\runs\\${RUN}\\Approval.JSON`)), null);
  assert.notEqual(violation(edit(`/p/runs/${RUN}/WORKFLOW-STATE.json`)), null);
  assert.notEqual(violation(multiEdit(`/p/runs/${RUN}/approval.json.3f2a.tmp`)), null);
  assert.notEqual(violation(write(`/p/runs/${RUN}/workflow-state.json.tmp`)), null);
  assert.notEqual(violation(bash(`cat runs/${RUN}/Approval.Json`)), null);
  assert.notEqual(violation(bash(`echo {} > runs/${RUN}/Workflow-State.JSON`)), null);
});

test("a shell command touching state must be a single workflow CLI call (F08)", () => {
  const chained = [
    `npm run -s wf -- status ${RUN}; echo {} > runs/${RUN}/workflow-state.json`,
    `npm run -s wf -- status ${RUN} && cp x runs/${RUN}/workflow-state.json`,
    `npm run -s wf -- status ${RUN} | tee runs/${RUN}/workflow-state.json`,
    `npm run -s wf -- status ${RUN} > runs/${RUN}/workflow-state.json`,
    `npm run -s wf -- status $(cat runs/${RUN}/workflow-state.json)`,
  ];
  for (const command of chained) assert.notEqual(violation(bash(command)), null, command);
});

test("blocks the model from invoking the approval commands via Skill or SlashCommand", () => {
  assert.notEqual(violation({ tool_name: "Skill", tool_input: { skill: "approve-event" } }), null);
  assert.notEqual(violation({ tool_name: "SlashCommand", tool_input: { command: `/reject-event ${RUN} x` } }), null);
  assert.equal(violation({ tool_name: "Skill", tool_input: { skill: "workflow-orchestration" } }), null);
});
