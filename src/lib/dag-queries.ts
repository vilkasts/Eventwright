import { DAG } from "@/config/dag";
import { OUTPUT_AGENT, OUTPUT_AREA } from "@/config/workflow";
import { isOneOf } from "@/lib/narrow";
import { AGENT_NAMES, GATE_IDS } from "@/types/workflow";
import type { AgentName, ArtifactAgentDefinition, ArtifactArea, GatedStage, GateId, Stage } from "@/types/workflow";

export const OPTIONAL_AGENTS: readonly AgentName[] = AGENT_NAMES.filter(
  (name) => DAG.agents[name].service !== undefined,
);

export const isAgentName = (value: unknown): value is AgentName => isOneOf(AGENT_NAMES, value);

export const parseAgentName = (value: string): AgentName => {
  if (!isAgentName(value)) throw new Error(`Unknown agent: ${value}. Known: ${AGENT_NAMES.join(", ")}.`);
  return value;
};

export const agentNamesForStage = (stage: Stage): AgentName[] =>
  AGENT_NAMES.filter((name) => DAG.agents[name].stage === stage);

export const gateIdsForStage = (stage: GatedStage): GateId[] => GATE_IDS.filter((id) => DAG.gates[id].stage === stage);

export const artifactDefinition = (name: AgentName): ArtifactAgentDefinition | null => {
  const definition = DAG.agents[name];
  return definition.kind === "artifact" ? definition : null;
};

export const artifactOf = (name: AgentName): string | null => artifactDefinition(name)?.artifact ?? null;

export const requireArtifactOf = (name: AgentName): string => {
  const artifact = artifactOf(name);
  if (artifact === null) throw new Error(`${name} does not own an artifact.`);
  return artifact;
};

export const outputFiles = (): readonly string[] => {
  const definition = DAG.agents[OUTPUT_AGENT];
  return definition.kind === "output" ? definition.outputs : [];
};

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

export const agentForFile = (area: ArtifactArea, fileName: string): AgentName | null => {
  if (area === OUTPUT_AREA) return outputFiles().includes(fileName) ? OUTPUT_AGENT : null;
  return AGENT_NAMES.find((name) => artifactOf(name) === fileName) ?? null;
};
