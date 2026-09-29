// How the CLI talks back: results go to stdout, errors to stderr.
import process from "node:process";

const JSON_INDENT = 2;

// Prints a result as JSON; the coordinator reads it (that is why `npm run -s` is used: no npm banner on stdout).
export const printJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, JSON_INDENT)}\n`);
};

// Prints plain text for humans (used by `wf status`).
export const printText = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

// Prints an error message; the CLI then exits with code 1.
export const printError = (message: string): void => {
  process.stderr.write(`${message}\n`);
};
