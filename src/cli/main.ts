// Entry point of the workflow CLI: `npm run -s wf -- <command> <args…>`.
// The coordinator (the main Claude Code session) changes run state only through these commands.
import process from "node:process";

import type { CommandRegistry } from "@/cli/command";
import { AGENT_COMMANDS } from "@/cli/commands/agent-commands";
import { FLOW_COMMANDS } from "@/cli/commands/flow-commands";
import { RUN_COMMANDS } from "@/cli/commands/run-commands";
import { printError } from "@/io/output";

// All commands in one table: run lifecycle, agent starts and checks, workflow transitions.
const COMMANDS: CommandRegistry = { ...RUN_COMMANDS, ...AGENT_COMMANDS, ...FLOW_COMMANDS };
const FAILURE_EXIT_CODE = 1;

// Coordinator CLI: stdout is JSON for the model; errors go to stderr with exit 1.
const [commandName = "", ...args] = process.argv.slice(2);
const command = COMMANDS[commandName];

try {
  if (command === undefined) throw new Error(`Commands: ${Object.keys(COMMANDS).join(", ")}`);
  command(args);
} catch (error) {
  printError(error instanceof Error ? error.message : String(error));
  process.exit(FAILURE_EXIT_CODE);
}
