// Basic file operations used by the rest of the io layer.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import { sha256 } from "@/lib/hash";

// JSON files are written pretty-printed so humans can read them.
const JSON_INDENT = 2;
const TEMPORARY_SUFFIX = ".tmp";

// True if the file (or folder) exists.
export const fileExists = (filePath: string): boolean => existsSync(filePath);

// The file's text (UTF-8); throws if it does not exist.
export const readText = (filePath: string): string => readFileSync(filePath, "utf8");

// The file's text, or "" if it does not exist.
export const readTextIfExists = (filePath: string): string =>
  existsSync(filePath) ? readFileSync(filePath, "utf8") : "";

// Parsed JSON as `unknown`: the caller must check its shape (see src/lib/schemas).
export const readJson = (filePath: string): unknown => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  return parsed;
};

// The sha256 of a file's bytes, or null if the file does not exist.
export const sha256OfFile = (filePath: string): string | null =>
  existsSync(filePath) ? sha256(readFileSync(filePath)) : null;

// Write through a temporary file: an interrupted process never leaves half a JSON file.
// The temporary name is unique per call so concurrent processes never rename each other's file.
export const writeJsonAtomic = (filePath: string, value: unknown): void => {
  const temporary = `${filePath}.${randomUUID()}${TEMPORARY_SUFFIX}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, JSON_INDENT)}\n`);
  renameSync(temporary, filePath);
};
