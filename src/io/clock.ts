// The current time and date, in the formats the workflow stores.

// Month and day are written with two digits (2026-09-05).
const DATE_PART_WIDTH = 2;
// Date.getMonth() counts from 0.
const MONTH_OFFSET = 1;

// A month or day number with a leading zero when needed (5 → "05").
const datePart = (value: number): string => String(value).padStart(DATE_PART_WIDTH, "0");

// The current moment as an ISO timestamp in UTC, e.g. "2026-09-30T11:41:49.000Z" (used in state and logs).
export const nowIso = (): string => new Date().toISOString();

// The local calendar date: the run id must match the "Today" the user and the agents see, not UTC (F16).
export const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${datePart(now.getMonth() + MONTH_OFFSET)}-${datePart(now.getDate())}`;
};
