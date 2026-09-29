import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { isApprovalFile } from "@/lib/schemas/approval-file";
import { approvedFile } from "@tests/support/approval-fixtures";

const RUNS = path.join(process.cwd(), "runs");

test("accepts a complete approval file", () => {
  assert.equal(isApprovalFile(approvedFile("run-1", "abc")), true);
});

test("rejects a record without who and when recorded it, or with a non-integer round (M6)", () => {
  const file = approvedFile("run-1", "abc");
  const current: Record<string, unknown> = { ...file.current };
  delete current.recordedBy;
  assert.equal(isApprovalFile({ runId: "run-1", current, history: [] }), false);
  assert.equal(isApprovalFile({ ...file, current: { ...file.current, round: 1.5 } }), false);
  assert.equal(isApprovalFile({ ...file, current: { ...file.current, feedback: 3 } }), false);
});

test("every saved demo approval still loads", () => {
  const files = readdirSync(RUNS)
    .map((runId) => path.join(RUNS, runId, "approval.json"))
    .filter((file) => existsSync(file));
  assert.ok(files.length > 0);
  for (const file of files) assert.equal(isApprovalFile(JSON.parse(readFileSync(file, "utf8"))), true, file);
});
