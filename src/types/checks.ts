// Types of the deterministic checks: money amounts, the budget check (G7) and the artifact structure rules.

// An amount of money with its ISO currency code, e.g. { amount: 9000, currency: "EUR" }.
export type Money = {
  amount: number;
  currency: string;
};

// Result of the budget check: the limit from the requirements, the total from the budget, and whether it fits.
export type BudgetStatus = {
  limit: Money | null;
  total: Money | null;
  withinLimit: boolean;
  // Why the check could not pass (missing line, currency mismatch); empty when both numbers were read.
  issues: string[];
};

// What one artifact must contain; built from the agent's definition in src/config/dag.ts.
export type ArtifactRules = {
  sections: readonly string[];
  requiredLines: readonly string[];
  // The Meta section must name this run and this agent.
  runId: string;
  agent: string;
  // Requirement ids (R-01, …) that must all appear, used for the final plan.
  requirementIds?: readonly string[];
  moneyLines?: readonly string[];
};
