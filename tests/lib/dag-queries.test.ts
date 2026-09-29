import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DAG } from "@/config/dag";
import { agentForFile, downstreamOf, OPTIONAL_AGENTS, parseAgentName } from "@/lib/dag-queries";
import { parseRunPath } from "@/lib/run-path";
import { AGENT_NAMES, SERVICES } from "@/types/workflow";

describe("DAG", () => {
  test("the graph has no cycles", () => {
    for (const name of AGENT_NAMES) assert.ok(!downstreamOf(name).includes(name), name);
  });
  test("optional agents are exactly the service planners", () => {
    assert.deepEqual(OPTIONAL_AGENTS, ["catering-planner", "entertainment-planner", "logistics-planner"]);
    assert.deepEqual(
      OPTIONAL_AGENTS.map((name) => DAG.agents[name].service),
      [...SERVICES],
    );
  });
});

describe("downstreamOf", () => {
  test("catering invalidates budget, plan and html only", () => {
    assert.deepEqual(downstreamOf("catering-planner").sort(), [
      "budget-aggregator",
      "event-plan-builder",
      "html-builder",
    ]);
  });
  test("venue invalidates all service planners and everything after", () => {
    assert.deepEqual(downstreamOf("venue-scout").sort(), [
      "budget-aggregator",
      "catering-planner",
      "entertainment-planner",
      "event-plan-builder",
      "html-builder",
      "logistics-planner",
    ]);
  });
});

describe("agentForFile / parseAgentName", () => {
  test("maps artifacts and outputs to their owners", () => {
    assert.equal(agentForFile("artifacts", "03-venues.md"), "venue-scout");
    assert.equal(agentForFile("output", "event-plan.html"), "html-builder");
    assert.equal(agentForFile("artifacts", "notes.md"), null);
  });
  test("rejects unknown agent names with the list of known ones", () => {
    assert.equal(parseAgentName("venue-scout"), "venue-scout");
    assert.throws(() => parseAgentName("nope"), /Unknown agent: nope\. Known: requirements-formalizer/);
  });
});

describe("parseRunPath", () => {
  test("parses windows paths", () => {
    assert.deepEqual(parseRunPath("C:\\p\\Eventwright\\runs\\2026-09-28-lisbon\\artifacts\\01-requirements.md"), {
      runId: "2026-09-28-lisbon",
      area: "artifacts",
      fileName: "01-requirements.md",
    });
  });
  test("parses output paths and ignores unrelated files", () => {
    assert.equal(parseRunPath("/x/runs/r/output/event-plan.html")?.area, "output");
    assert.equal(parseRunPath("/x/src/config/dag.ts"), null);
    assert.equal(parseRunPath("/x/runs/r/input.md"), null);
    assert.equal(parseRunPath("/x/runs/r/notes/a.md"), null);
  });
});
