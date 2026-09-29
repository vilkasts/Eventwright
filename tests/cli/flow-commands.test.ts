import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { cliJson, initRun, readRunState, requirementsFixture, runCli, writeArtifact } from "@tests/support/run-cli";
import { useTempProject } from "@tests/support/temp-project";

beforeEach(() => {
  useTempProject();
});

test("plan requires confirmed requirements", () => {
  const runId = initRun("plan-early");
  writeArtifact(runId, "01-requirements.md", requirementsFixture(runId));
  assert.match(runCli("plan", runId).err, /not confirmed/);
});

test("plan skips the planners of services that were not requested, once", () => {
  const runId = initRun("plan-skip");
  writeArtifact(runId, "01-requirements.md", requirementsFixture(runId, "venue, entertainment, logistics"));
  runCli("confirm-requirements", runId);
  assert.deepEqual(cliJson("plan", runId).skipped, ["catering-planner"]);
  assert.equal(readRunState(runId).agents["catering-planner"].status, "skipped");
  assert.match(runCli("plan", runId).err, /already set/);
});

test("invalidate stores feedback for revise mode", () => {
  const runId = initRun("inv");
  const result = runCli("invalidate", runId, "requirements-formalizer", "--feedback", "budget", "is", "10000", "EUR");
  assert.equal(result.code, 0);
  assert.equal(readRunState(runId).agents["requirements-formalizer"].feedback, "budget is 10000 EUR");
});

test("invalidate without feedback is rejected", () => {
  const runId = initRun("inv-empty");
  assert.match(runCli("invalidate", runId, "venue-scout").err, /usage/);
});

test("budget reports a missing budget artifact without failing", () => {
  const runId = initRun("budget");
  const result = runCli("budget", runId);
  assert.equal(result.code, 0);
  assert.match(result.out, /"withinLimit": false/);
});

test("record-gates refuses a report the validator did not write since the gates were reset", () => {
  const runId = initRun("stale-report");
  writeArtifact(runId, "validation-domain.md", "| G1-requirements-complete | PASS | requirements-formalizer | — |");
  const result = runCli("record-gates", runId, "domain");
  assert.equal(result.code, 1);
  assert.match(result.err, /relaunch the validator/);
  assert.equal(readRunState(runId).gates["G1-requirements-complete"].status, "pending");
});

test("record-gates needs a known stage and a validator report", () => {
  const runId = initRun("no-report");
  assert.match(runCli("record-gates", runId, "later").err, /Stage must be one of/);
  assert.match(runCli("record-gates", runId, "domain").err, /validation-domain\.md/);
});

test("repeating the same invalidate reports that it changed nothing", () => {
  const runId = initRun("inv-twice");
  const args = ["invalidate", runId, "requirements-formalizer", "--feedback", "budget", "10000", "EUR"] as const;
  assert.equal(cliJson(...args).alreadyInvalidated, false);
  assert.equal(cliJson(...args).alreadyInvalidated, true);
});
