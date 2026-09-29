const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;

export const escapeRegExp = (text: string): string => text.replace(REGEXP_SPECIAL, "\\$&");
