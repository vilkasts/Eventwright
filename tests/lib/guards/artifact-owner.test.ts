import assert from "node:assert/strict";
import { test } from "node:test";

import { artifactOwnerViolation } from "@/lib/guards/artifact-owner";
import { parseHookInput } from "@/lib/hook-input";

const RUN = "2026-09-28-lisbon";
const violation = (file: string, agentType?: string, tool = "Write"): string | null =>
  artifactOwnerViolation(
    parseHookInput({ tool_name: tool, agent_type: agentType, tool_input: { file_path: file, content: "x" } }),
  );

test("the owning agent may write its artifact, report or output", () => {
  assert.equal(violation(`/p/runs/${RUN}/artifacts/03-venues.md`, "venue-scout"), null);
  assert.equal(violation(`C:\\p\\runs\\${RUN}\\artifacts\\validation-domain.md`, "validator"), null);
  assert.equal(violation(`/p/runs/${RUN}/output/event-plan.html`, "html-builder"), null);
});

test("another agent may not write an artifact it does not own", () => {
  assert.match(
    violation(`/p/runs/${RUN}/artifacts/03-venues.md`, "catering-planner", "Edit") ?? "",
    /owned by venue-scout/,
  );
  assert.match(
    violation(`/p/runs/${RUN}/artifacts/validation-final.md`, "event-plan-builder") ?? "",
    /owned by validator/,
  );
});

test("the coordinator may not write artifacts or outputs", () => {
  assert.match(violation(`/p/runs/${RUN}/artifacts/07-budget.md`) ?? "", /the coordinator must not write it/);
  assert.match(violation(`/p/runs/${RUN}/output/event-plan.md`) ?? "", /owned by html-builder/);
});

test("files outside the workflow graph and the run root stay writable", () => {
  assert.equal(violation(`/p/runs/${RUN}/input.md`), null);
  assert.equal(violation(`/p/runs/${RUN}/clarifications.md`), null);
  assert.equal(violation(`/p/runs/${RUN}/artifacts/notes.md`), null);
  assert.equal(violation("/p/README.md"), null);
});
