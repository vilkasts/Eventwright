import assert from "node:assert/strict";
import { test } from "node:test";

import { todayIso } from "@/io/clock";

test("todayIso is the local calendar date, not the UTC one (F16)", () => {
  const now = new Date();
  const local = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0"));
  assert.equal(todayIso(), local.join("-"));
});
