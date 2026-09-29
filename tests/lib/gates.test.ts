import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { MAX_RETRIES } from "@/config/workflow";
import { parseGateTable, recordGates, staleReportIssue } from "@/lib/gates";
import { createInitialState, recordArtifactWrite } from "@/lib/state";
import type { WorkflowState } from "@/types/workflow";
import { gateReport, withoutGateRow } from "@tests/support/gate-fixtures";
import { confirmWithPlan } from "@tests/support/plan-fixtures";
import { DOMAIN_AGENTS, markDone, NOW } from "@tests/support/state-fixtures";

let state: WorkflowState;
beforeEach(() => {
  state = createInitialState("run-1", NOW);
  markDone(state, DOMAIN_AGENTS);
  confirmWithPlan(state);
});

describe("parseGateTable", () => {
  test("ignores header rows", () => {
    assert.equal(parseGateTable("## Gate results\n| Gate | Status |\n|---|---|\n").size, 0);
  });
  test("reads only the Gate results section, so a row quoted in Details cannot override it", () => {
    const report = `${gateReport("domain", { "G4-venue-fit": "venue-scout" })}\n## Details\n| G4-venue-fit | PASS | venue-scout | — |`;
    assert.equal(parseGateTable(report).get("G4-venue-fit")?.status, "FAIL");
  });
  test("rejects a report without the Gate results section", () => {
    assert.throws(() => parseGateTable("| G1-requirements-complete | PASS | x | — |"), /Gate results/);
  });
  test("rejects duplicate rows for one gate", () => {
    const report = `${gateReport("domain")}\n| G4-venue-fit | FAIL | venue-scout | again |`;
    assert.throws(() => parseGateTable(report), /more than one row for gates: G4-venue-fit/);
  });
});

describe("staleReportIssue", () => {
  const REPORT = { runId: "run-1", area: "artifacts", fileName: "validation-domain.md" } as const;

  test("rejects a report the validator did not write after the gates were reset", () => {
    assert.match(staleReportIssue(state, "domain", "hash-old") ?? "", /relaunch the validator/);
  });
  test("rejects a report that was already recorded", () => {
    recordArtifactWrite(state, REPORT, "hash-1", "validator", NOW);
    recordGates(state, "domain", gateReport("domain"), NOW);
    assert.match(staleReportIssue(state, "domain", "hash-1") ?? "", /already recorded/);
  });
  test("rejects a report file that differs from the one the validator wrote", () => {
    recordArtifactWrite(state, REPORT, "hash-1", "validator", NOW);
    assert.match(staleReportIssue(state, "domain", "hash-other") ?? "", /changed after the validator wrote it/);
  });
  test("rejects a report that was not written by the validator subagent", () => {
    recordArtifactWrite(state, REPORT, "hash-1", "coordinator", NOW);
    assert.match(staleReportIssue(state, "domain", "hash-1") ?? "", /written by coordinator, not by the validator/);
  });
  test("keeps the writer when the report is recorded", () => {
    recordArtifactWrite(state, REPORT, "hash-1", "validator", NOW);
    recordGates(state, "domain", gateReport("domain"), NOW);
    assert.equal(state.validation.domain?.writer, "validator");
  });
  test("accepts the report the validator has just written", () => {
    recordArtifactWrite(state, REPORT, "hash-1", "validator", NOW);
    assert.equal(staleReportIssue(state, "domain", "hash-1"), null);
  });
});

describe("recordGates", () => {
  test("a failing gate makes only its owners and their downstream stale", () => {
    const summary = recordGates(
      state,
      "domain",
      gateReport("domain", { "G5-dietary-coverage": "catering-planner" }),
      NOW,
    );
    assert.deepEqual(summary.failed, [{ id: "G5-dietary-coverage", owners: ["catering-planner"] }]);
    assert.equal(state.agents["catering-planner"].status, "stale");
    assert.equal(state.agents["budget-aggregator"].status, "stale");
    assert.equal(state.agents["venue-scout"].status, "done");
    assert.match(state.agents["catering-planner"].lastError ?? "", /G5-dietary-coverage/);
  });

  test("owners outside the gate's owner list fall back to all of its owners", () => {
    const summary = recordGates(state, "domain", gateReport("domain", { "G3-weather-grounded": "venue-scout" }), NOW);
    assert.deepEqual(summary.failed[0]?.owners, ["weather-analyst"]);
  });

  test("a passing gate clears its failure counter", () => {
    recordGates(state, "domain", gateReport("domain", { "G3-weather-grounded": "weather-analyst" }), NOW);
    markDone(state, DOMAIN_AGENTS);
    recordGates(state, "domain", gateReport("domain"), NOW);
    assert.deepEqual(state.gates["G3-weather-grounded"], { status: "pass", attempts: 0, findings: [] });
  });

  test("the run is blocked after MAX_RETRIES consecutive failures", () => {
    const failing = { "G3-weather-grounded": "weather-analyst" };
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      recordGates(state, "domain", gateReport("domain", failing), NOW);
      assert.equal(state.failure, null);
      markDone(state, DOMAIN_AGENTS);
    }
    const summary = recordGates(state, "domain", gateReport("domain", failing), NOW);
    assert.deepEqual(summary.blocked, ["G3-weather-grounded"]);
    assert.equal(state.failure?.kind, "gate");
  });

  test("a report with a missing gate row throws and does not count an attempt", () => {
    const partial = withoutGateRow(gateReport("domain"), "G4-venue-fit");
    assert.throws(() => recordGates(state, "domain", partial, NOW), /G4-venue-fit/);
    assert.equal(state.gates["G4-venue-fit"].attempts, 0);
  });

  test("not-applicable gates need no row", () => {
    state = createInitialState("run-2", NOW);
    markDone(
      state,
      DOMAIN_AGENTS.filter((name) => name !== "catering-planner"),
    );
    confirmWithPlan(state, ["venue", "entertainment", "logistics"]);
    const report = withoutGateRow(gateReport("domain"), "G5-dietary-coverage");
    assert.deepEqual(recordGates(state, "domain", report, NOW).failed, []);
    assert.equal(state.gates["G5-dietary-coverage"].status, "n/a");
  });

  test("rewriting an agent resets only the passed gates it owns", () => {
    recordGates(state, "domain", gateReport("domain"), NOW);
    recordArtifactWrite(
      state,
      { runId: "run-1", area: "artifacts", fileName: "02-weather-outlook.md" },
      "new",
      "test",
      NOW,
    );
    assert.equal(state.gates["G3-weather-grounded"].status, "pending");
    assert.equal(state.gates["G1-requirements-complete"].status, "pass");
  });
});
