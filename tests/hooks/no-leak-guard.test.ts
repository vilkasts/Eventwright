import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { artifactPath } from "@/io/paths";
import { outputPath, RUN, runHook, setupRun, writePayload } from "@tests/support/run-hook";

beforeEach(setupRun);

test("denies internal names in the final document and lists them", () => {
  const result = runHook(
    "no-leak-guard",
    writePayload(outputPath("event-plan.md"), "See 03-venues.md from venue-scout"),
  );
  assert.equal(result.decision, "deny");
  assert.match(result.stdout, /03-venues\.md, venue-scout/);
});

test("ignores internal names inside workflow artifacts", () => {
  assert.equal(
    runHook("no-leak-guard", writePayload(artifactPath(RUN, "08-event-plan.md"), "03-venues.md")).decision,
    null,
  );
});
