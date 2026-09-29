// Constants shared by the hooks: which Claude Code tools they watch and how they block.

// Tools that write files.
export const FILE_TOOLS: readonly string[] = ["Write", "Edit", "MultiEdit"];
// Tools that run shell commands.
export const SHELL_TOOLS: readonly string[] = ["Bash", "PowerShell"];
// Tools that can run a slash command on the model's behalf.
export const COMMAND_TOOLS: readonly string[] = ["Skill", "SlashCommand"];

// Commands that only a human may type (see approval).
export const HUMAN_ONLY_COMMANDS: readonly string[] = ["approve-event", "reject-event"];

// The only allowed way to change state from a shell.
export const WORKFLOW_CLI_PREFIX = /^\s*npm run -s wf -- /;

// Exit code that makes Claude Code block the prompt and show the hook's message.
export const HOOK_BLOCK_EXIT_CODE = 2;
