// Сужение unknown-данных (JSON с диска, stdin hooks) без приведений типов.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  values.some((item) => item === value);

export const stringOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

// Массив из JSON как unknown[]: элементы по-прежнему нужно сужать.
export const listOf = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return [];
  const items: unknown[] = value;
  return items;
};

// Строит Record по полному списку ключей; проверка сохраняет строгий тип без `as`.
export const recordOf = <K extends string, V>(keys: readonly K[], make: (key: K) => V): Record<K, V> => {
  const result: Partial<Record<K, V>> = {};
  for (const key of keys) result[key] = make(key);
  if (!hasAllKeys(keys, result)) throw new Error("recordOf: a key was not filled");
  return result;
};

const hasAllKeys = <K extends string, V>(keys: readonly K[], value: Partial<Record<K, V>>): value is Record<K, V> =>
  keys.every((key) => value[key] !== undefined);
