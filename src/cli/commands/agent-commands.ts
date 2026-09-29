import type { CommandRegistry } from "@/cli/command";
import { requireRun } from "@/cli/require-run";
import { REQUIREMENTS_AGENT } from "@/config/workflow";
import { nowIso } from "@/io/clock";
import { fileExists, readText, readTextIfExists } from "@/io/files";
import { printJson } from "@/io/output";
import { artifactPath } from "@/io/paths";
import { saveState } from "@/io/state-store";
import { recordAgentStarts, recordStructureCheck } from "@/lib/agent-runs";
import { checkArtifact, extractRequirementIds } from "@/lib/artifact-check";
import { artifactDefinition, parseAgentName, requireArtifactOf } from "@/lib/dag-queries";
import type { AgentName } from "@/types/workflow";

const inspectArtifact = (runId: string, name: AgentName): string[] => {
  const definition = artifactDefinition(name);
  if (definition === null) throw new Error(`${name} does not own an artifact.`);
  const file = artifactPath(runId, definition.artifact);
  if (!fileExists(file)) return [`${definition.artifact} was not written.`];
  const requirementIds = definition.coversRequirements
    ? extractRequirementIds(readTextIfExists(artifactPath(runId, requireArtifactOf(REQUIREMENTS_AGENT))))
    : [];
  return checkArtifact(readText(file), {
    sections: definition.sections,
    requiredLines: definition.requiredLines,
    runId,
    agent: name,
    requirementIds,
  });
};

// Запуски агентов и структурный гейт после каждой группы.
export const AGENT_COMMANDS: CommandRegistry = {
  start: ([runId, ...names]) => {
    const state = requireRun(runId);
    const agents = names.map(parseAgentName);
    recordAgentStarts(state, agents, nowIso());
    saveState(state);
    printJson({ ok: true, started: agents });
  },

  // Самопроверка агента: состояние не меняется.
  lint: ([runId, name = ""]) => {
    const state = requireRun(runId);
    const issues = inspectArtifact(state.runId, parseAgentName(name));
    if (issues.length > 0) throw new Error(issues.join("\n"));
    printJson({ ok: true });
  },

  check: ([runId, name = ""]) => {
    const state = requireRun(runId);
    const agent = parseAgentName(name);
    const issues = inspectArtifact(state.runId, agent);
    recordStructureCheck(state, agent, issues, nowIso());
    saveState(state);
    if (issues.length > 0) throw new Error(issues.join("\n"));
    printJson({ ok: true });
  },
};
