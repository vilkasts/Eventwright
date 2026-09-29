import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { artifactPath } from "@/io/paths";
import { outputPath, prepareAwaitingApproval, RUN, runHook, setupRun, writePayload } from "@tests/support/run-hook";

const guard = (payload: unknown): string | null => runHook("approval-gate-guard", payload).decision;
const approve = (): void => {
  runHook("record-approval", { prompt: `/approve-event ${RUN}` });
};

beforeEach(() => {
  setupRun();
  prepareAwaitingApproval();
});

test("blocks output before approval", () => {
  assert.equal(guard(writePayload(outputPath("event-plan.html"), "<html>")), "deny");
});

test("allows output after a human approval of the current plan", () => {
  approve();
  assert.equal(guard(writePayload(outputPath("event-plan.html"), "<html>")), null);
});

test("an edit of the plan after approval blocks output again", () => {
  approve();
  writeFileSync(artifactPath(RUN, "08-event-plan.md"), "# Event plan v2\n");
  assert.equal(guard(writePayload(outputPath("event-plan.md"), "x")), "deny");
});

test("blocks shell writes into output", () => {
  assert.equal(
    guard({ tool_name: "Bash", tool_input: { command: `echo x > runs/${RUN}/output/event-plan.md` } }),
    "deny",
  );
});
