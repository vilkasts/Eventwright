// Questions about the workflow graph (src/config/dag.ts): who owns which file, who depends on whom.
import { DAG } from "@/config/dag";
import { OUTPUT_AGENT, OUTPUT_AREA } from "@/config/workflow";
import { isOneOf } from "@/lib/narrow";
import { AGENT_NAMES, GATE_IDS } from "@/types/workflow";
import type { AgentName, ArtifactAgentDefinition, ArtifactArea, GatedStage, GateId, Stage } from "@/types/workflow";

// Agents that run only when their service is requested (catering, entertainment, logistics planners).
export const OPTIONAL_AGENTS: readonly AgentName[] = AGENT_NAMES.filter(
  (name) => DAG.agents[name].service !== undefined,
);

// True if the value is the name of a workflow agent.
export const isAgentName = (value: unknown): value is AgentName => isOneOf(AGENT_NAMES, value);

// Checks a name typed on the command line; throws with the list of valid names if it is unknown.
export const parseAgentName = (value: string): AgentName => {
  if (!isAgentName(value)) throw new Error(`Unknown agent: ${value}. Known: ${AGENT_NAMES.join(", ")}.`);
  return value;
};

// All agents of a stage, in graph order.
export const agentNamesForStage = (stage: Stage): AgentName[] =>
  AGENT_NAMES.filter((name) => DAG.agents[name].stage === stage);

// All gates that check a stage.
export const gateIdsForStage = (stage: GatedStage): GateId[] => GATE_IDS.filter((id) => DAG.gates[id].stage === stage);

// The definition of an agent that writes an artifact, or null for html-builder (which writes output files).
export const artifactDefinition = (name: AgentName): ArtifactAgentDefinition | null => {
  const definition = DAG.agents[name];
  return definition.kind === "artifact" ? definition : null;
};

// The artifact file name of an agent, e.g. "03-venues.md", or null.
export const artifactOf = (name: AgentName): string | null => artifactDefinition(name)?.artifact ?? null;

// Like artifactOf, but for agents that must have an artifact; throws otherwise.
export const requireArtifactOf = (name: AgentName): string => {
  const artifact = artifactOf(name);
  if (artifact === null) throw new Error(`${name} does not own an artifact.`);
  return artifact;
};

// The user-facing files html-builder writes (event-plan.md, event-plan.html).
export const outputFiles = (): readonly string[] => {
  const definition = DAG.agents[OUTPUT_AGENT];
  return definition.kind === "output" ? definition.outputs : [];
};

// Every agent that directly or indirectly reads this agent's artifact.
// When an artifact changes, these agents must run again (breadth-first walk over "deps").
export const downstreamOf = (agentName: AgentName): AgentName[] => {
  const result = new Set<AgentName>();
  const queue: AgentName[] = [agentName];
  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    for (const name of AGENT_NAMES) {
      if (DAG.agents[name].deps.includes(current) && !result.has(name)) {
        result.add(name);
        queue.push(name);
      }
    }
  }
  return [...result];
};

// The agent that owns a file of a run, or null if the file belongs to no agent.
export const agentForFile = (area: ArtifactArea, fileName: string): AgentName | null => {
  if (area === OUTPUT_AREA) return outputFiles().includes(fileName) ? OUTPUT_AGENT : null;
  return AGENT_NAMES.find((name) => artifactOf(name) === fileName) ?? null;
};
