// Normalized hook payload: Claude Code snake_case fields are mapped to camelCase during parsing.
// Claude Code sends this data on stdin to every hook; only the fields the hooks need are kept.
export type HookInput = {
  // The tool being used: Write, Edit, Bash, Skill, …
  toolName: string | null;
  // The file a file tool writes to.
  filePath: string | null;
  // The shell command (Bash, PowerShell) or slash command text.
  command: string | null;
  // The skill name for the Skill tool.
  skill: string | null;
  // All text a file tool is about to write (content, new_string, every MultiEdit replacement).
  writtenText: string;
  // For UserPromptSubmit: the raw text the human typed.
  prompt: string | null;
  // The subagent that makes the call; null for the main session (the coordinator).
  agentType: string | null;
};
