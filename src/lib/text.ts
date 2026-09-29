// Small text helpers.

// Characters that have a special meaning inside a regular expression.
const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;

// Makes any text safe to use inside a regular expression, e.g. "Contingency (10%)" matches literally.
export const escapeRegExp = (text: string): string => text.replace(REGEXP_SPECIAL, "\\$&");
