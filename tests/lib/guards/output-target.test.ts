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

test("ignores artifacts and other tools", () => {
  assert.equal(
    target({ tool_name: "Write", tool_input: { file_path: "/p/runs/r1/artifacts/08-event-plan.md" } }),
    null,
  );
  assert.equal(target({ tool_name: "Read", tool_input: { file_path: "/p/runs/r1/output/event-plan.md" } }), null);
});
