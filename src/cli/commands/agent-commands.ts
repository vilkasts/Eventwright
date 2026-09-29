// CLI commands around agents: `start` (before launching), `lint` (agent self-check), `check` (structural gate).
import type { CommandRegistry } from "@/cli/command";
import { requireRun, updateRun } from "@/cli/require-run";
import { REQUIREMENTS_AGENT } from "@/config/workflow";
import { nowIso } from "@/io/clock";
import { fileExists, readText, readTextIfExists } from "@/io/files";
import { printJson } from "@/io/output";
import { artifactPath } from "@/io/paths";
import { recordAgentStarts, recordStructureCheck, startedWithoutWriteIssues, startIssues } from "@/lib/agent-runs";
import { checkArtifact, extractRequirementIds } from "@/lib/artifact-check";
import { artifactDefinition, parseAgentName, requireArtifactOf } from "@/lib/dag-queries";
import type { AgentName, WorkflowState } from "@/types/workflow";

// Runs the structure check on an agent's artifact file, using that agent's rules from the graph.
// The final plan must also mention every requirement id found in 01-requirements.md.
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
    moneyLines: definition.moneyLines ?? [],
    runId,
    agent: name,
    requirementIds,
  });
};

// Structure issues plus a start that was never followed by a recorded Write.
const artifactIssues = (state: WorkflowState, name: AgentName): string[] => [
  ...startedWithoutWriteIssues(state, name),
  ...inspectArtifact(state.runId, name),
];

// Agent starts and the structural gate after every group.
export const AGENT_COMMANDS: CommandRegistry = {
  // wf start <runId> <agent…> → called right before launching agents; refuses agents that may not start yet.
  start: ([runId, ...names]) => {
    const agents = names.map(parseAgentName);
    updateRun(runId, (state) => {
      const issues = startIssues(state, agents);
      if (issues.length > 0) throw new Error(issues.join("\n"));
      recordAgentStarts(state, agents, nowIso());
      return { isChanged: true, result: null };
    });
    printJson({ ok: true, started: agents });
  },

  // wf lint <runId> <agent> → agent self-check after writing its artifact: the state is not changed.
  lint: ([runId, name = ""]) => {
    const state = requireRun(runId);
    const issues = artifactIssues(state, parseAgentName(name));
    if (issues.length > 0) throw new Error(issues.join("\n"));
    printJson({ ok: true });
  },

  // wf check <runId> <agent> → the coordinator's structural gate after a group; the result is saved,
  // and on failure `next` sends the agent back in retry mode with the listed problems.
  check: ([runId, name = ""]) => {
    const agent = parseAgentName(name);
    const issues = updateRun(runId, (state) => {
      const found = artifactIssues(state, agent);
      recordStructureCheck(state, agent, found, nowIso());
      return { isChanged: true, result: found };
    });
    if (issues.length > 0) throw new Error(issues.join("\n"));
    printJson({ ok: true });
  },
};
