const DATE_PART_WIDTH = 2;
// Date.getMonth() counts from 0.
const MONTH_OFFSET = 1;

const datePart = (value: number): string => String(value).padStart(DATE_PART_WIDTH, "0");

export const nowIso = (): string => new Date().toISOString();

// The local calendar date: the run id must match the "Today" the user and the agents see, not UTC (F16).
export const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${datePart(now.getMonth() + MONTH_OFFSET)}-${datePart(now.getDate())}`;
};
