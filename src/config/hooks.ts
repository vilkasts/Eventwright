export const FILE_TOOLS: readonly string[] = ["Write", "Edit", "MultiEdit"];
export const SHELL_TOOLS: readonly string[] = ["Bash", "PowerShell"];
export const COMMAND_TOOLS: readonly string[] = ["Skill", "SlashCommand"];

// Команды, которые может набрать только человек (§ одобрение).
export const HUMAN_ONLY_COMMANDS: readonly string[] = ["approve-event", "reject-event"];

// Единственный разрешённый способ менять состояние из shell.
export const WORKFLOW_CLI_PREFIX = /^\s*npm run -s wf -- /;

export const HOOK_BLOCK_EXIT_CODE = 2;
