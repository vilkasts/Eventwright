import process from "node:process";

import type { CommandRegistry } from "@/cli/command";
import { RUN_COMMANDS } from "@/cli/commands/run-commands";
import { printError } from "@/io/output";

const COMMANDS: CommandRegistry = { ...RUN_COMMANDS };
const FAILURE_EXIT_CODE = 1;

// CLI координатора: stdout — JSON для модели, ошибки — stderr и exit 1.
const [commandName = "", ...args] = process.argv.slice(2);
const command = COMMANDS[commandName];

try {
  if (command === undefined) throw new Error(`Commands: ${Object.keys(COMMANDS).join(", ")}`);
  command(args);
} catch (error) {
  printError(error instanceof Error ? error.message : String(error));
  process.exit(FAILURE_EXIT_CODE);
}
