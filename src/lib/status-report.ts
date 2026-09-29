import { MAX_RETRIES } from "@/config/workflow";
import { AGENT_NAMES, GATE_IDS } from "@/types/workflow";
import type { AgentState, WorkflowState } from "@/types/workflow";

const STATUS_COLUMN_WIDTH = 8;

const agentNote = (agent: AgentState): string => {
  if (agent.feedback !== null) return ` — feedback: ${agent.feedback}`;
  return agent.lastError !== null ? ` — ${agent.lastError}` : "";
};

export const formatStatus = (state: WorkflowState): string => {
  const lines = [`Run ${state.runId} — phase: ${state.phase}`];
  if (state.plan !== null) {
    const skipped = state.plan.skipped.length > 0 ? state.plan.skipped.join(", ") : "none";
    lines.push(`Execution plan: ${state.plan.selected.join(", ")}; skipped: ${skipped}`);
  }
  lines.push("", "Agents:");
  for (const name of AGENT_NAMES) {
    const agent = state.agents[name];
    lines.push(`  ${agent.status.padEnd(STATUS_COLUMN_WIDTH)} ${name} (runs: ${agent.attempts})${agentNote(agent)}`);
  }
  lines.push("", "Gates:");
  for (const id of GATE_IDS) {
    const gate = state.gates[id];
    lines.push(`  ${gate.status.padEnd(STATUS_COLUMN_WIDTH)} ${id} (failures: ${gate.attempts}/${MAX_RETRIES})`);
  }
  if (state.failure !== null) lines.push("", `STOPPED: ${JSON.stringify(state.failure)}`);
  return lines.join("\n");
};
