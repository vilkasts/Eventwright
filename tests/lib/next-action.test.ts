import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { MAX_RETRIES } from "@/config/workflow";
import { recordGates } from "@/lib/gates";
import { sha256 } from "@/lib/hash";
import { nextAction } from "@/lib/next-action";
import { createInitialState, invalidateAgents, recordArtifactWrite } from "@/lib/state";
import type { Action, AgentName, Brief, WorkflowState } from "@/types/workflow";
import { approvedFile, buildAwaitingApprovalState, PLAN_TEXT } from "@tests/support/approval-fixtures";
import { gateReport } from "@tests/support/gate-fixtures";
import { confirmWithPlan } from "@tests/support/plan-fixtures";
import { DOMAIN_AGENTS, markDone, NOW } from "@tests/support/state-fixtures";

const briefs = (action: Action): Brief[] => (action.action === "run" ? action.agents : []);
const names = (action: Action): AgentName[] => briefs(action).map((brief) => brief.name);

let state: WorkflowState;
beforeEach(() => {
  state = createInitialState("run-1", NOW);
});

describe("before planning", () => {
  test("starts with the formalizer in initial mode", () => {
    const action = nextAction(state, null);
    assert.deepEqual(names(action), ["requirements-formalizer"]);
    assert.equal(briefs(action)[0]?.mode, "initial");
  });
  test("checks an artifact that was written but never structure-checked (crash after write)", () => {
    recordArtifactWrite(state, { runId: "run-1", area: "artifacts", fileName: "01-requirements.md" }, "h", "test", NOW);
    assert.deepEqual(nextAction(state, null), { action: "check", agents: ["requirements-formalizer"] });
  });
  test("asks for clarification until requirements are confirmed", () => {
    markDone(state, ["requirements-formalizer"]);
    assert.deepEqual(nextAction(state, null), { action: "clarify" });
  });
  test("asks for an execution plan after confirmation", () => {
    markDone(state, ["requirements-formalizer"]);
    state.requirementsConfirmed = true;
    assert.deepEqual(nextAction(state, null), { action: "plan" });
  });
});

describe("dependency groups", () => {
  test("walks the groups and runs the three service planners in parallel", () => {
    markDone(state, ["requirements-formalizer"]);
    confirmWithPlan(state);
    assert.deepEqual(names(nextAction(state, null)), ["weather-analyst"]);
    markDone(state, ["weather-analyst"]);
    assert.deepEqual(names(nextAction(state, null)), ["venue-scout"]);
    markDone(state, ["venue-scout"]);
    assert.deepEqual(names(nextAction(state, null)), [
      "catering-planner",
      "entertainment-planner",
      "logistics-planner",
    ]);
    markDone(state, ["catering-planner", "entertainment-planner", "logistics-planner"]);
    assert.deepEqual(names(nextAction(state, null)), ["budget-aggregator"]);
  });
  test("runs only the requested service planners and feeds the budget only their artifacts", () => {
    markDone(state, ["requirements-formalizer", "weather-analyst", "venue-scout"]);
    confirmWithPlan(state, ["venue", "entertainment", "logistics"]);
    assert.deepEqual(names(nextAction(state, null)), ["entertainment-planner", "logistics-planner"]);
    markDone(state, ["entertainment-planner", "logistics-planner"]);
    const [budget] = briefs(nextAction(state, null));
    assert.ok(budget);
    assert.equal(budget.name, "budget-aggregator");
    assert.ok(!budget.inputs.includes("04-catering.md"));
  });
  test("resume re-runs only the agent that was running when the process died", () => {
    markDone(state, ["requirements-formalizer", "weather-analyst", "venue-scout", "catering-planner"]);
    confirmWithPlan(state);
    state.agents["entertainment-planner"].status = "running";
    assert.deepEqual(names(nextAction(state, null)), ["entertainment-planner", "logistics-planner"]);
  });
});

describe("gates", () => {
  beforeEach(() => {
    markDone(state, DOMAIN_AGENTS);
    confirmWithPlan(state);
  });

  test("validates the domain stage once all domain agents are done", () => {
    const action = nextAction(state, null);
    assert.equal(action.action, "validate");
    assert.equal(action.stage, "domain");
    assert.equal(action.recheck.length, 9);
  });
  test("not-applicable gates are not re-checked", () => {
    state = createInitialState("run-2", NOW);
    markDone(
      state,
      DOMAIN_AGENTS.filter((name) => name !== "catering-planner"),
    );
    confirmWithPlan(state, ["venue", "entertainment", "logistics"]);
    const action = nextAction(state, null);
    assert.equal(action.action, "validate");
    assert.ok(!action.recheck.includes("G5-dietary-coverage"));
    assert.deepEqual(action.notApplicable, ["G5-dietary-coverage"]);
  });
  test("records an unrecorded validator report instead of re-running the validator", () => {
    recordArtifactWrite(
      state,
      { runId: "run-1", area: "artifacts", fileName: "validation-domain.md" },
      "h",
      "validator",
      NOW,
    );
    assert.deepEqual(nextAction(state, null), { action: "record-gates", stage: "domain" });
  });
  test("after a failing gate only the owner re-runs, in retry mode", () => {
    recordGates(state, "domain", gateReport("domain", { "G5-dietary-coverage": "catering-planner" }), NOW);
    const [brief] = briefs(nextAction(state, null));
    assert.ok(brief);
    assert.equal(brief.name, "catering-planner");
    assert.equal(brief.mode, "retry");
    assert.match(brief.reason ?? "", /G5-dietary-coverage/);
  });
  test("a blocked gate stops the run", () => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      recordGates(state, "domain", gateReport("domain", { "G3-weather-grounded": "weather-analyst" }), NOW);
      markDone(state, DOMAIN_AGENTS);
    }
    assert.equal(nextAction(state, null).action, "failed");
  });
});

describe("approval and revision", () => {
  beforeEach(() => {
    state = buildAwaitingApprovalState("run-1");
  });

  test("awaits approval for the current plan hash", () => {
    assert.deepEqual(nextAction(state, null), { action: "await-approval", planSha256: sha256(PLAN_TEXT) });
  });
  test("renders once the current plan hash is approved", () => {
    assert.deepEqual(names(nextAction(state, approvedFile("run-1", sha256(PLAN_TEXT)))), ["html-builder"]);
  });
  test("an approval of an older plan version is ignored", () => {
    assert.equal(nextAction(state, approvedFile("run-1", "old")).action, "await-approval");
  });
  test("invalidating the venue after a rejection regenerates everything downstream in revise mode", () => {
    invalidateAgents(state, ["venue-scout"], "Pick the second venue", NOW);
    assert.equal(state.agents["weather-analyst"].status, "done");
    const downstream = [
      "catering-planner",
      "entertainment-planner",
      "logistics-planner",
      "budget-aggregator",
      "event-plan-builder",
    ] as const;
    for (const name of downstream) assert.equal(state.agents[name].status, "stale", name);
    assert.equal(state.gates["G4-venue-fit"].status, "pending");
    const [brief] = briefs(nextAction(state, null));
    assert.ok(brief);
    assert.equal(brief.name, "venue-scout");
    assert.equal(brief.mode, "revise");
    assert.equal(brief.feedback, "Pick the second venue");
  });
});
