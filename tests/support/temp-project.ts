// Test helper: an empty temporary project folder for each test.
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Each test gets its own empty checkout: io resolves runs/ through CLAUDE_PROJECT_DIR.
export const useTempProject = (): string => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "eventwright-"));
  process.env.CLAUDE_PROJECT_DIR = directory;
  return directory;
};
