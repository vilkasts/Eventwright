export const FILE_TOOLS: readonly string[] = ["Write", "Edit", "MultiEdit"];
export const SHELL_TOOLS: readonly string[] = ["Bash", "PowerShell"];
export const COMMAND_TOOLS: readonly string[] = ["Skill", "SlashCommand"];

// Commands that only a human may type (see approval).
export const HUMAN_ONLY_COMMANDS: readonly string[] = ["approve-event", "reject-event"];

// The only allowed way to change state from a shell.
export const WORKFLOW_CLI_PREFIX = /^\s*npm run -s wf -- /;

export const HOOK_BLOCK_EXIT_CODE = 2;
