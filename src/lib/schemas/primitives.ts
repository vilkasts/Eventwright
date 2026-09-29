// Shared checks for data read from disk: each answers "is this value of the stored shape?".

// A whole number that is zero or more (attempt counters, round numbers).
export const isCount = (value: unknown): boolean => typeof value === "number" && Number.isInteger(value) && value >= 0;

// True for any string.
export const isString = (value: unknown): boolean => typeof value === "string";

// True for a string or null (for optional text fields such as feedback).
export const isStringOrNull = (value: unknown): boolean => value === null || typeof value === "string";

// An array whose every item passes the given check.
export const isListOf = (value: unknown, isItem: (item: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(isItem);
