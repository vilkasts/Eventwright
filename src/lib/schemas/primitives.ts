// Shared checks for data read from disk: each answers "is this value of the stored shape?".
export const isCount = (value: unknown): boolean => typeof value === "number" && Number.isInteger(value) && value >= 0;

export const isString = (value: unknown): boolean => typeof value === "string";

export const isStringOrNull = (value: unknown): boolean => value === null || typeof value === "string";

export const isListOf = (value: unknown, isItem: (item: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(isItem);
