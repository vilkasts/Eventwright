import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { createInitialState, invalidateAgents, recordArtifactWrite } from "@/lib/state";
import type { ArtifactArea, WorkflowState } from "@/types/workflow";
import { DOMAIN_AGENTS, markDone, NOW } from "@tests/support/state-fixtures";

let state: WorkflowState;
const write = (fileName: string, hash: string, area: ArtifactArea = "artifacts"): boolean =>
  recordArtifactWrite(state, { runId: state.runId, area, fileName }, hash, "test", NOW);

beforeEach(() => {
  state = createInitialState("run-1", NOW);
});

describe("createInitialState", () => {
  test("starts with every agent and gate pending and no execution plan", () => {
    assert.ok(Object.values(state.agents).every((agent) => agent.status === "pending"));
    assert.ok(Object.values(state.gates).every((gate) => gate.status === "pending"));
    assert.equal(state.plan, null);
    assert.equal(state.requirementsConfirmed, false);
  });
});

describe("recordArtifactWrite", () => {
  test("marks the owner done and waits for a structure check", () => {
    assert.equal(write("02-weather-outlook.md", "h1"), true);
    assert.equal(state.agents["weather-analyst"].status, "done");
    assert.equal(state.agents["weather-analyst"].sha256, "h1");
    assert.equal(state.agents["weather-analyst"].structureOk, false);
  });
  test("an identical rewrite is a no-op", () => {
    write("02-weather-outlook.md", "h1");
    assert.equal(write("02-weather-outlook.md", "h1"), false);
  });
  test("a changed artifact makes finished downstream work stale", () => {
    markDone(state, DOMAIN_AGENTS);
    write("02-weather-outlook.md", "h2");
    assert.equal(state.agents["requirements-formalizer"].status, "done");
    for (const name of ["venue-scout", "catering-planner", "entertainment-planner", "logistics-planner"] as const) {
      assert.equal(state.agents[name].status, "stale", name);
    }
  });
  test("a write resets the counter of starts without an artifact", () => {
    state.agents["weather-analyst"].startsWithoutArtifact = 3;
    write("02-weather-outlook.md", "h1");
    assert.equal(state.agents["weather-analyst"].startsWithoutArtifact, 0);
  });
  test("new requirements must be confirmed again", () => {
    markDone(state, ["requirements-formalizer"]);
    state.requirementsConfirmed = true;
    write("01-requirements.md", "v2");
    assert.equal(state.requirementsConfirmed, false);
  });
  test("html-builder is done only after both outputs exist", () => {
    write("event-plan.md", "m", "output");
    assert.equal(state.agents["html-builder"].status, "pending");
    write("event-plan.html", "h", "output");
    assert.equal(state.agents["html-builder"].status, "done");
  });
  test("a validator report is stored as not yet recorded", () => {
    write("validation-domain.md", "r");
    assert.equal(state.validation.domain?.recorded, false);
  });
  test("unrelated files are ignored", () => {
    assert.equal(write("notes.md", "x"), false);
  });
});

describe("invalidateAgents", () => {
  test("marks the agents for revision and their finished downstream stale", () => {
    markDone(state, DOMAIN_AGENTS);
    invalidateAgents(state, ["venue-scout"], "Pick the second venue", NOW);
    assert.equal(state.agents["venue-scout"].status, "stale");
    assert.equal(state.agents["venue-scout"].feedback, "Pick the second venue");
    assert.equal(state.agents["weather-analyst"].status, "done");
    assert.equal(state.agents["budget-aggregator"].status, "stale");
  });
  test("rejects the output agent without changing anything", () => {
    assert.throws(() => {
      invalidateAgents(state, ["venue-scout", "html-builder"], "x", NOW);
    }, /html-builder/);
    assert.equal(state.agents["venue-scout"].feedback, null);
  });
  test("feedback is cleared once the agent rewrites its artifact", () => {
    invalidateAgents(state, ["requirements-formalizer"], "Budget is 10000 EUR", NOW);
    write("01-requirements.md", "v2");
    assert.equal(state.agents["requirements-formalizer"].feedback, null);
  });
});
