import assert from "node:assert/strict";
import { test } from "node:test";

import { budgetStatus, parseMoney } from "@/lib/budget";

test("parseMoney reads a strict money line", () => {
  assert.deepEqual(parseMoney("x\n- Budget: 9000 EUR\n", "Budget"), { amount: 9000, currency: "EUR" });
  assert.deepEqual(parseMoney("- Total with contingency: 8712.5 EUR", "Total with contingency"), {
    amount: 8712.5,
    currency: "EUR",
  });
});
test("parseMoney rejects thousands separators and missing lines", () => {
  assert.equal(parseMoney("- Budget: 9,000 EUR", "Budget"), null);
  assert.equal(parseMoney("nothing", "Budget"), null);
});
test("budgetStatus passes when the total fits the limit", () => {
  const status = budgetStatus("- Budget: 9000 EUR", "- Total with contingency: 8800 EUR");
  assert.equal(status.withinLimit, true);
  assert.deepEqual(status.issues, []);
});
test("budgetStatus fails over the limit and on currency mismatch", () => {
  assert.equal(budgetStatus("- Budget: 9000 EUR", "- Total with contingency: 9100 EUR").withinLimit, false);
  const mismatch = budgetStatus("- Budget: 9000 EUR", "- Total with contingency: 8000 PLN");
  assert.equal(mismatch.withinLimit, false);
  assert.match(mismatch.issues.join(), /currency/);
});
