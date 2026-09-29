import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Каждый тест получает свой пустой checkout: io резолвит runs/ через CLAUDE_PROJECT_DIR.
export const useTempProject = (): string => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "eventwright-"));
  process.env.CLAUDE_PROJECT_DIR = directory;
  return directory;
};
