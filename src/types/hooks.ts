// Нормализованный payload hook: поля Claude Code в snake_case приводятся к camelCase при разборе.
export type HookInput = {
  toolName: string | null;
  filePath: string | null;
  command: string | null;
  skill: string | null;
  writtenText: string;
  prompt: string | null;
  agentType: string | null;
};
