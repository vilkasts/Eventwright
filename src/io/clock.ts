const ISO_DATE_LENGTH = 10;

export const nowIso = (): string => new Date().toISOString();

export const todayIso = (): string => nowIso().slice(0, ISO_DATE_LENGTH);
