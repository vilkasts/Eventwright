import assert from "node:assert/strict";
import { test } from "node:test";

import { parseApprovalCommand } from "@/lib/approval-command";

test("parses an approval", () => {
  assert.deepEqual(parseApprovalCommand("  /approve-event run-1 "), { runId: "run-1", decision: "approved" });
});

test("parses a rejection with multi-line feedback", () => {
  assert.deepEqual(parseApprovalCommand("/reject-event run-1 add a photo booth\nand a DJ"), {
    runId: "run-1",
    decision: "rejected",
    feedback: "add a photo booth\nand a DJ",
  });
});

test("a rejection without feedback keeps feedback null", () => {
  assert.deepEqual(parseApprovalCommand("/reject-event run-1"), {
    runId: "run-1",
    decision: "rejected",
    feedback: null,
  });
});

test("ignores ordinary prompts and approvals with extra words", () => {
  assert.equal(parseApprovalCommand("please approve"), null);
  assert.equal(parseApprovalCommand("/approve-event run-1 now"), null);
});
