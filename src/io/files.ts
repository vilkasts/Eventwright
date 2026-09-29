import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import { sha256 } from "@/lib/hash";

const JSON_INDENT = 2;
const TEMPORARY_SUFFIX = ".tmp";

export const fileExists = (filePath: string): boolean => existsSync(filePath);

export const readText = (filePath: string): string => readFileSync(filePath, "utf8");

export const readTextIfExists = (filePath: string): string =>
  existsSync(filePath) ? readFileSync(filePath, "utf8") : "";

export const readJson = (filePath: string): unknown => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  return parsed;
};

export const sha256OfFile = (filePath: string): string | null =>
  existsSync(filePath) ? sha256(readFileSync(filePath)) : null;

// Write through a temporary file: an interrupted process never leaves half a JSON file.
export const writeJsonAtomic = (filePath: string, value: unknown): void => {
  const temporary = `${filePath}${TEMPORARY_SUFFIX}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, JSON_INDENT)}\n`);
  renameSync(temporary, filePath);
};
