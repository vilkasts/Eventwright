import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { readApproval } from "@/io/approval-store";
import { approvalPath } from "@/io/paths";
import { prepareAwaitingApproval, RUN, runHook, setupRun } from "@tests/support/run-hook";

beforeEach(setupRun);

test("ignores ordinary prompts", () => {
  assert.equal(runHook("record-approval", { prompt: "hello" }).code, 0);
  assert.equal(existsSync(approvalPath(RUN)), false);
});

test("blocks unknown run ids", () => {
  const result = runHook("record-approval", { prompt: "/approve-event nope" });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /not found/);
});

test("blocks a rejection without feedback", () => {
  prepareAwaitingApproval();
  const result = runHook("record-approval", { prompt: `/reject-event ${RUN}` });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /feedback/);
  assert.equal(existsSync(approvalPath(RUN)), false);
});

test("blocks a decision when the run is not awaiting approval", () => {
  const result = runHook("record-approval", { prompt: `/approve-event ${RUN}` });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /not awaiting approval/);
});

test("records an approval and reports it to the context", () => {
  prepareAwaitingApproval();
  const result = runHook("record-approval", { prompt: `/approve-event ${RUN}` });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /'approved' recorded/);
  assert.equal(readApproval(RUN)?.current.decision, "approved");
});

test("records a rejection with feedback (prompt_text field also accepted)", () => {
  prepareAwaitingApproval();
  assert.equal(runHook("record-approval", { prompt_text: `/reject-event ${RUN} add a photo booth` }).code, 0);
  assert.equal(readApproval(RUN)?.current.feedback, "add a photo booth");
});

test("blocks a malformed approval instead of ignoring it", () => {
  prepareAwaitingApproval();
  for (const prompt of [`/approve-event ${RUN} now`, "/approve-event"]) {
    const result = runHook("record-approval", { prompt });
    assert.equal(result.code, 2, prompt);
    assert.match(result.stderr, /Usage: \/approve-event <runId>/);
  }
  assert.equal(existsSync(approvalPath(RUN)), false);
});
