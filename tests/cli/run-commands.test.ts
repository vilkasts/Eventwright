import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { statePath } from "@/io/paths";

import { cliJson, initRun, readRunState, runCli } from "@tests/support/run-cli";
import { useTempProject } from "@tests/support/temp-project";

beforeEach(() => {
  useTempProject();
});

test("init creates a run and next starts with the formalizer", () => {
  const runId = initRun("lisbon-birthday");
  assert.match(runId, /^\d{4}-\d{2}-\d{2}-lisbon-birthday$/);
  assert.match(runCli("next", runId).out, /"name": "requirements-formalizer"/);
});

test("init rejects bad slugs and duplicate runs", () => {
  assert.equal(runCli("init", "Bad Slug").code, 1);
  initRun("dup");
  assert.match(runCli("init", "dup").err, /already exists/);
});

test("list and status describe existing runs", () => {
  const runId = initRun("listed");
  assert.match(runCli("list").out, new RegExp(runId));
  assert.match(runCli("status", runId).out, /requirements-formalizer/);
  assert.equal(runCli("status", "missing").code, 1);
});

test("next saves the phase and --resume logs a resume event", () => {
  const runId = initRun("resume-me");
  assert.equal(cliJson("next", runId, "--resume").action, "run");
  const state = readRunState(runId);
  assert.equal(state.phase, "run");
  assert.ok(state.log.some((entry) => entry.event === "resume"));
});

test("an unknown command lists the available ones", () => {
  assert.match(runCli("nope").err, /Commands: init, list, status, next/);
});

test("list reports a broken run next to the valid ones (F12)", () => {
  const good = initRun("good");
  const broken = initRun("broken");
  writeFileSync(statePath(broken), "{ not json");
  const result = runCli("list");
  assert.equal(result.code, 0);
  const runs: unknown = JSON.parse(result.out);
  assert.ok(Array.isArray(runs));
  assert.match(JSON.stringify(runs), new RegExp(`"runId":"${good}","phase"`));
  assert.match(JSON.stringify(runs), new RegExp(`"runId":"${broken}","error"`));
});

test("commands reject run ids that could leave runs/ (F10)", () => {
  assert.match(runCli("status", "../escape").err, /Invalid run id/);
});
