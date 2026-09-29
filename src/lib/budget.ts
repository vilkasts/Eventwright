import { escapeRegExp } from "@/lib/text";
import type { BudgetStatus, Money } from "@/types/checks";

const LIMIT_LABEL = "Budget";
const TOTAL_LABEL = "Total with contingency";

// Strict "- <Label>: 9000 EUR" format without thousands separators, otherwise G7 cannot be checked deterministically.
export const parseMoney = (text: string, label: string): Money | null => {
  const pattern = new RegExp(`^\\s*- ${escapeRegExp(label)}:\\s*(\\d+(?:\\.\\d+)?)\\s+([A-Z]{3})\\s*$`, "m");
  const [, amount, currency] = pattern.exec(text) ?? [];
  if (amount === undefined || currency === undefined) return null;
  return { amount: Number(amount), currency };
};

export const budgetStatus = (requirementsText: string, budgetText: string): BudgetStatus => {
  const limit = parseMoney(requirementsText, LIMIT_LABEL);
  const total = parseMoney(budgetText, TOTAL_LABEL);
  const issues: string[] = [];
  if (limit === null) issues.push(`requirements lack a '- ${LIMIT_LABEL}: <amount> <CUR>' line`);
  if (total === null) issues.push(`budget lacks a '- ${TOTAL_LABEL}: <amount> <CUR>' line`);
  if (limit !== null && total !== null && limit.currency !== total.currency) {
    issues.push(`currency mismatch: limit ${limit.currency}, total ${total.currency}`);
  }
  const withinLimit = issues.length === 0 && limit !== null && total !== null && total.amount <= limit.amount;
  return { limit, total, withinLimit, issues };
};
