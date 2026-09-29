export type Money = {
  amount: number;
  currency: string;
};

export type BudgetStatus = {
  limit: Money | null;
  total: Money | null;
  withinLimit: boolean;
  issues: string[];
};

export type ArtifactRules = {
  sections: readonly string[];
  requiredLines: readonly string[];
  runId: string;
  agent: string;
  requirementIds?: readonly string[];
  moneyLines?: readonly string[];
};
