// Normalized hook payload: Claude Code snake_case fields are mapped to camelCase during parsing.
export type HookInput = {
  toolName: string | null;
  filePath: string | null;
  command: string | null;
  skill: string | null;
  writtenText: string;
  prompt: string | null;
  agentType: string | null;
};
