// CLI commands that move a run forward: confirm requirements, set the execution plan, check the budget,
// record gate results, and invalidate agents after a rejection.
import type { CommandRegistry } from "@/cli/command";
import { requireRun, updateRun } from "@/cli/require-run";
import { BUDGET_AGENT, REQUIREMENTS_AGENT, STAGE_ORDER, validationFileName } from "@/config/workflow";
import { nowIso } from "@/io/clock";
import { fileExists, readText, readTextIfExists, sha256OfFile } from "@/io/files";
import { printJson } from "@/io/output";
import { artifactPath } from "@/io/paths";
import { budgetStatus } from "@/lib/budget";
import { parseAgentName, requireArtifactOf } from "@/lib/dag-queries";
import { applyExecutionPlan, parseServices } from "@/lib/execution-plan";
import { recordGates, staleReportIssue } from "@/lib/gates";
import { confirmRequirements, invalidateAgents } from "@/lib/state";
import type { GatedStage } from "@/types/workflow";

// In `wf invalidate`, everything after this flag is the human's feedback.
const FEEDBACK_FLAG = "--feedback";

// The text of 01-requirements.md (or "" before it exists).
const requirementsText = (runId: string): string =>
  readTextIfExists(artifactPath(runId, requireArtifactOf(REQUIREMENTS_AGENT)));

// Checks the stage argument: "domain" or "final".
const parseStage = (value: string | undefined): GatedStage => {
  const stage = STAGE_ORDER.find((item) => item === value);
  if (stage === undefined) throw new Error(`Stage must be one of: ${STAGE_ORDER.join(", ")}.`);
  return stage;
};

// Workflow transitions: requirements confirmation, execution plan, gates, invalidation.
export const FLOW_COMMANDS: CommandRegistry = {
  // wf confirm-requirements <runId> → the human said the requirements are right.
  "confirm-requirements": ([runId]) => {
    updateRun(runId, (state) => {
      confirmRequirements(state, nowIso());
      return { isChanged: true, result: null };
    });
    printJson({ ok: true });
  },

  // wf plan <runId> → reads "- Services:" and decides which planners run (once per confirmed requirements).
  plan: ([runId]) => {
    const plan = updateRun(runId, (state) => {
      if (!state.requirementsConfirmed)
        throw new Error("Requirements are not confirmed yet — finish the clarify phase first.");
      if (state.plan !== null) throw new Error(`Execution plan already set: ${state.plan.selected.join(", ")}`);
      const services = parseServices(requirementsText(state.runId));
      if (services === null) throw new Error(`${requireArtifactOf(REQUIREMENTS_AGENT)} lacks a '- Services: …' line.`);
      return { isChanged: true, result: applyExecutionPlan(state, services, nowIso()) };
    });
    printJson(plan);
  },

  // wf budget <runId> → the G7 arithmetic (limit, total, withinLimit) for the validator.
  // Always exit 0: the validator reads the G7 result from the JSON.
  budget: ([runId]) => {
    const state = requireRun(runId);
    const budgetText = readTextIfExists(artifactPath(state.runId, requireArtifactOf(BUDGET_AGENT)));
    printJson(budgetStatus(requirementsText(state.runId), budgetText));
  },

  // wf record-gates <runId> <stage> → applies the validator's fresh report to the gates and schedules retries.
  "record-gates": ([runId, stageName]) => {
    const stage = parseStage(stageName);
    const summary = updateRun(runId, (state) => {
      const reportFile = artifactPath(state.runId, validationFileName(stage));
      if (!fileExists(reportFile)) throw new Error(`No ${validationFileName(stage)} — run the validator first.`);
      const issue = staleReportIssue(state, stage, sha256OfFile(reportFile));
      if (issue !== null) throw new Error(issue);
      return { isChanged: true, result: recordGates(state, stage, readText(reportFile), nowIso()) };
    });
    printJson(summary);
  },

  // wf invalidate <runId> <agent…> --feedback <text> → after a rejection, sends upstream agents back to revise
  // with the human's feedback; everything built on them is regenerated.
  invalidate: ([runId, ...rest]) => {
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
    const isChanged = updateRun(runId, (state) => {
      const changed = invalidateAgents(state, agents, feedback, nowIso());
      return { isChanged: changed, result: changed };
    });
    printJson({ ok: true, invalidated: agents, alreadyInvalidated: !isChanged });
  },
};
