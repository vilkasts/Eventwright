import { MAX_RETRIES } from "@/config/workflow";
import { appendLog } from "@/lib/state";
import type { AgentName, WorkflowState } from "@/types/workflow";

const NO_ARTIFACT_FINDING = "agent failed to produce its artifact";

// Агент, который раз за разом падает без артефакта, не доходит до гейтов — лимит считаем здесь.
export const recordAgentStarts = (state: WorkflowState, names: readonly AgentName[], now: string): void => {
  for (const name of names) {
    const agent = state.agents[name];
    agent.status = "running";
    agent.attempts += 1;
    agent.startsWithoutArtifact += 1;
    if (agent.startsWithoutArtifact <= MAX_RETRIES + 1) continue;
    state.failure ??= {
      kind: "agent",
      agent: name,
      findings: [NO_ARTIFACT_FINDING],
      attempts: agent.startsWithoutArtifact,
      at: now,
    };
  }
  appendLog(state, "agents-started", { agents: names }, now);
};

// Структурный гейт после каждой группы: провал возвращает агента в работу, лимит — MAX_RETRIES подряд.
export const recordStructureCheck = (
  state: WorkflowState,
  name: AgentName,
  issues: readonly string[],
  now: string,
): void => {
  const agent = state.agents[name];
  if (issues.length === 0) {
    agent.structureOk = true;
    agent.structuralFailures = 0;
    appendLog(state, "structure-ok", { agent: name }, now);
    return;
  }
  if (agent.status === "done") agent.status = "stale";
  agent.structureOk = false;
  agent.structuralFailures += 1;
  agent.lastError = `Structure check: ${issues.join(" ")}`;
  if (agent.structuralFailures > MAX_RETRIES) {
    state.failure ??= {
      kind: "agent",
      agent: name,
      findings: [...issues],
      attempts: agent.structuralFailures,
      at: now,
    };
  }
  appendLog(state, "structure-failed", { agent: name, issues }, now);
};
