import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { isWorkflowState } from "@/lib/schemas/workflow-state";
import { createInitialState } from "@/lib/state";
import { NOW } from "@tests/support/state-fixtures";

const RUNS = path.join(process.cwd(), "runs");

// A state from disk with one field changed, as JSON would bring it (unknown shape).
const withAgentField = (field: string, value: unknown): unknown => {
  const state: unknown = JSON.parse(JSON.stringify(createInitialState("run-1", NOW)));
  const agents = typeof state === "object" && state !== null && "agents" in state ? state.agents : null;
  const agent = typeof agents === "object" && agents !== null && "venue-scout" in agents ? agents["venue-scout"] : null;
  if (typeof agent !== "object" || agent === null) throw new Error("fixture: no venue-scout agent");
  Reflect.set(agent, field, value);
  return state;
};

test("accepts a fresh state", () => {
  assert.equal(isWorkflowState(JSON.parse(JSON.stringify(createInitialState("run-1", NOW)))), true);
});

test("rejects a state whose agent lacks a counter or has a mistyped field (F06)", () => {
  for (const field of ["startsWithoutArtifact", "structuralFailures", "outputs"]) {
    assert.equal(isWorkflowState(withAgentField(field, undefined)), false, field);
  }
  assert.equal(isWorkflowState(withAgentField("attempts", Number.NaN)), false);
  assert.equal(isWorkflowState(withAgentField("sha256", 1)), false);
  assert.equal(isWorkflowState(withAgentField("outputs", { "event-plan.md": 1 })), false);
});

test("every saved demo run still loads", () => {
  const runIds = existsSync(RUNS)
    ? readdirSync(RUNS).filter((id) => existsSync(path.join(RUNS, id, "workflow-state.json")))
    : [];
  assert.ok(runIds.length > 0);
  for (const runId of runIds) {
    const raw: unknown = JSON.parse(readFileSync(path.join(RUNS, runId, "workflow-state.json"), "utf8"));
    assert.equal(isWorkflowState(raw), true, runId);
  }
});
