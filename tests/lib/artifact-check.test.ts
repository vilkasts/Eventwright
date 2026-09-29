import assert from "node:assert/strict";
import { test } from "node:test";

import { checkArtifact, extractRequirementIds } from "@/lib/artifact-check";
import type { ArtifactRules } from "@/types/checks";

const VALID = [
  "# Catering",
  "",
  "## Meta",
  "- Run: run-1",
  "- Agent: catering-planner",
  "## Summary",
  "Text.",
  "## Menu",
  "Covers R-01 and R-02.",
  "## Cost",
  "- Catering cost: 2400 EUR",
  "## Sources",
  "- https://example.com/menu — menu prices",
  "## Open questions",
  "None",
].join("\n");

const RULES: ArtifactRules = {
  sections: ["Menu", "Cost"],
  requiredLines: ["- Catering cost:"],
  runId: "run-1",
  agent: "catering-planner",
};

const issuesOf = (text: string, rules: ArtifactRules = RULES): string => checkArtifact(text, rules).join("\n");

test("accepts a well-formed artifact", () => {
  assert.deepEqual(checkArtifact(VALID, RULES), []);
});
test("rejects wrong section order", () => {
  const swapped = VALID.replace("## Menu", "## TMP").replace("## Cost", "## Menu").replace("## TMP", "## Cost");
  assert.match(issuesOf(swapped), /sections/i);
});
test("rejects a missing required line", () => {
  assert.match(issuesOf(VALID.replace("- Catering cost: 2400 EUR", "about 2400")), /Catering cost/);
});
test("rejects sources without a citation", () => {
  assert.match(issuesOf(VALID.replace("- https://example.com/menu — menu prices", "- the internet")), /Sources/);
});
test("rejects a wrong run id", () => {
  assert.match(issuesOf(VALID.replace("- Run: run-1", "- Run: other")), /Run: run-1/);
});
test("rejects template placeholders", () => {
  assert.match(issuesOf(VALID.replace("Text.", "TODO")), /placeholder/i);
});
test("reports uncovered requirement ids", () => {
  assert.match(issuesOf(VALID, { ...RULES, requirementIds: ["R-01", "R-03"] }), /R-03/);
});
test("extractRequirementIds returns unique sorted ids", () => {
  assert.deepEqual(extractRequirementIds("- R-02: x\n- R-01 [MUST]: y\nsee R-02"), ["R-01", "R-02"]);
});
