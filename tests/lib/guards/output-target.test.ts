import assert from "node:assert/strict";
import { test } from "node:test";

import { outputRunId } from "@/lib/guards/output-target";
import { parseHookInput } from "@/lib/hook-input";

const target = (payload: unknown): string | null => outputRunId(parseHookInput(payload));

test("finds the run of a file write into output", () => {
  assert.equal(
    target({ tool_name: "Write", tool_input: { file_path: "C:\\p\\runs\\r1\\output\\event-plan.html" } }),
    "r1",
  );
});

test("finds the run of a shell write into output", () => {
  assert.equal(target({ tool_name: "Bash", tool_input: { command: "echo x > runs/r2/output/event-plan.md" } }), "r2");
});

test("read-only shell commands on output are not treated as writes", () => {
  assert.equal(target({ tool_name: "Bash", tool_input: { command: "cat runs/r2/output/event-plan.md" } }), null);
  assert.equal(target({ tool_name: "Bash", tool_input: { command: 'grep "^## " runs/*/output/event-plan.md' } }), null);
  assert.equal(
    target({ tool_name: "PowerShell", tool_input: { command: "Get-Content runs\\r2\\output\\event-plan.md" } }),
    null,
  );
});

test("shell commands that copy or write into output are still caught", () => {
  assert.equal(target({ tool_name: "Bash", tool_input: { command: "cp plan.md runs/r3/output/event-plan.md" } }), "r3");
  assert.equal(
    target({ tool_name: "PowerShell", tool_input: { command: "Set-Content runs\\r4\\output\\event-plan.html x" } }),
    "r4",
  );
});

test("ignores artifacts and other tools", () => {
  assert.equal(
    target({ tool_name: "Write", tool_input: { file_path: "/p/runs/r1/artifacts/08-event-plan.md" } }),
    null,
  );
  assert.equal(target({ tool_name: "Read", tool_input: { file_path: "/p/runs/r1/output/event-plan.md" } }), null);
});

test("a shell write into the output folder itself is caught", () => {
  assert.equal(target({ tool_name: "Bash", tool_input: { command: "cp plan.md runs/r5/output" } }), "r5");
  assert.equal(target({ tool_name: "Bash", tool_input: { command: "cd runs/r6/output && echo x > a.md" } }), "r6");
  assert.equal(target({ tool_name: "Bash", tool_input: { command: "cp plan.md runs/r7/outputs/x.md" } }), null);
});
