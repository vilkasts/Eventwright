import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { MAX_RETRIES } from "@/config/workflow";
import { cliJson, initRun, readRunState, requirementsFixture, runCli, writeArtifact } from "@tests/support/run-cli";
import { useTempProject } from "@tests/support/temp-project";

beforeEach(() => {
  useTempProject();
});

test("check reports a malformed artifact and counts the failure", () => {
  const runId = initRun("check-bad");
  writeArtifact(runId, "01-requirements.md", "# Requirements\n");
  const result = runCli("check", runId, "requirements-formalizer");
  assert.equal(result.code, 1);
  assert.match(result.err, /sections/);
  assert.equal(readRunState(runId).agents["requirements-formalizer"].structuralFailures, 1);
});

test("check of a valid artifact records the passed structure check", () => {
  const runId = initRun("check-good");
  writeArtifact(runId, "01-requirements.md", requirementsFixture(runId));
  assert.equal(runCli("check", runId, "requirements-formalizer").code, 0);
  assert.equal(readRunState(runId).agents["requirements-formalizer"].structureOk, true);
});

test("lint reports issues without touching the state", () => {
  const runId = initRun("lint-me");
  writeArtifact(runId, "01-requirements.md", "# Requirements\n");
  assert.equal(runCli("lint", runId, "requirements-formalizer").code, 1);
  assert.equal(readRunState(runId).agents["requirements-formalizer"].structuralFailures, 0);
});

test("start stops the run when an agent keeps failing without an artifact", () => {
  const runId = initRun("flaky");
  for (let attempt = 0; attempt <= MAX_RETRIES + 1; attempt += 1) runCli("start", runId, "requirements-formalizer");
  assert.equal(cliJson("next", runId).action, "failed");
});

test("start and check reject unknown agents", () => {
  const runId = initRun("unknown-agent");
  assert.match(runCli("start", runId, "nope").err, /Unknown agent: nope/);
  assert.match(runCli("check", runId, "html-builder").err, /does not own an artifact/);
});

test("check and lint reject an artifact that was not rewritten since the agent started", () => {
  const runId = initRun("not-rewritten");
  writeArtifact(runId, "01-requirements.md", requirementsFixture(runId));
  runCli("start", runId, "requirements-formalizer");
  const lint = runCli("lint", runId, "requirements-formalizer");
  assert.equal(lint.code, 1);
  assert.match(lint.err, /not rewritten since requirements-formalizer started/);
  const check = runCli("check", runId, "requirements-formalizer");
  assert.equal(check.code, 1);
  assert.match(readRunState(runId).agents["requirements-formalizer"].lastError ?? "", /Write tool/);
});
