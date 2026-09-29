import process from "node:process";

const JSON_INDENT = 2;

export const printJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, JSON_INDENT)}\n`);
};

export const printText = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

export const printError = (message: string): void => {
  process.stderr.write(`${message}\n`);
};
