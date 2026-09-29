import type { CommandRegistry } from "@/cli/command";
import { requireRun } from "@/cli/require-run";
import { BUDGET_AGENT, REQUIREMENTS_AGENT, STAGE_ORDER, validationFileName } from "@/config/workflow";
import { nowIso } from "@/io/clock";
import { fileExists, readText, readTextIfExists } from "@/io/files";
import { printJson } from "@/io/output";
import { artifactPath } from "@/io/paths";
import { saveState } from "@/io/state-store";
import { budgetStatus } from "@/lib/budget";
import { parseAgentName, requireArtifactOf } from "@/lib/dag-queries";
import { applyExecutionPlan, parseServices } from "@/lib/execution-plan";
import { recordGates } from "@/lib/gates";
import { confirmRequirements, invalidateAgents } from "@/lib/state";
import type { GatedStage } from "@/types/workflow";

const FEEDBACK_FLAG = "--feedback";

const requirementsText = (runId: string): string =>
  readTextIfExists(artifactPath(runId, requireArtifactOf(REQUIREMENTS_AGENT)));

const parseStage = (value: string | undefined): GatedStage => {
  const stage = STAGE_ORDER.find((item) => item === value);
  if (stage === undefined) throw new Error(`Stage must be one of: ${STAGE_ORDER.join(", ")}.`);
  return stage;
};

// Workflow transitions: requirements confirmation, execution plan, gates, invalidation.
export const FLOW_COMMANDS: CommandRegistry = {
  "confirm-requirements": ([runId]) => {
    const state = requireRun(runId);
    confirmRequirements(state, nowIso());
    saveState(state);
    printJson({ ok: true });
  },

  plan: ([runId]) => {
    const state = requireRun(runId);
    if (!state.requirementsConfirmed)
      throw new Error("Requirements are not confirmed yet — finish the clarify phase first.");
    if (state.plan !== null) throw new Error(`Execution plan already set: ${state.plan.selected.join(", ")}`);
    const services = parseServices(requirementsText(state.runId));
    if (services === null) throw new Error(`${requireArtifactOf(REQUIREMENTS_AGENT)} lacks a '- Services: …' line.`);
    const plan = applyExecutionPlan(state, services, nowIso());
    saveState(state);
    printJson(plan);
  },

  // Always exit 0: the validator reads the G7 result from the JSON.
  budget: ([runId]) => {
    const state = requireRun(runId);
    const budgetText = readTextIfExists(artifactPath(state.runId, requireArtifactOf(BUDGET_AGENT)));
    printJson(budgetStatus(requirementsText(state.runId), budgetText));
  },

  "record-gates": ([runId, stageName]) => {
    const state = requireRun(runId);
    const stage = parseStage(stageName);
    const reportFile = artifactPath(state.runId, validationFileName(stage));
    if (!fileExists(reportFile)) throw new Error(`No ${validationFileName(stage)} — run the validator first.`);
    const summary = recordGates(state, stage, readText(reportFile), nowIso());
    saveState(state);
    printJson(summary);
  },

  invalidate: ([runId, ...rest]) => {
    const state = requireRun(runId);
    const flagIndex = rest.indexOf(FEEDBACK_FLAG);
    const names = flagIndex === -1 ? rest : rest.slice(0, flagIndex);
    const feedback =
      flagIndex === -1
        ? ""
        : rest
            .slice(flagIndex + 1)
            .join(" ")
            .trim();
    if (names.length === 0 || feedback.length === 0) {
      throw new Error("usage: invalidate <runId> <agent...> --feedback <text>");
    }
    const agents = names.map(parseAgentName);
    invalidateAgents(state, agents, feedback, nowIso());
    saveState(state);
    printJson({ ok: true, invalidated: agents });
  },
};
