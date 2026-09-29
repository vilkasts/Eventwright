// CLI commands for the run as a whole: create it, list runs, show status, and compute the next step.
import type { CommandRegistry } from "@/cli/command";
import { requireRun, updateRun } from "@/cli/require-run";
import { readApproval } from "@/io/approval-store";
import { nowIso, todayIso } from "@/io/clock";
import { printJson, printText } from "@/io/output";
import { createRun, listRunIds, loadState, stateExists } from "@/io/state-store";
import { nextAction } from "@/lib/next-action";
import { appendLog, createInitialState } from "@/lib/state";
import { formatStatus } from "@/lib/status-report";

// The short name the coordinator derives from the request, e.g. "lisbon-birthday".
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// `wf next <runId> --resume` also logs that an interrupted run was resumed.
const RESUME_FLAG = "--resume";

// Run lifecycle: create, list, status and compute the next step.
export const RUN_COMMANDS: CommandRegistry = {
  // wf init <slug> → creates runs/<today>-<slug>/ and prints { runId }.
  init: ([slug = ""]) => {
    if (!SLUG.test(slug)) throw new Error("slug must be lowercase kebab-case, e.g. lisbon-birthday");
    const runId = `${todayIso()}-${slug}`;
    if (stateExists(runId)) throw new Error(`Run ${runId} already exists — use /resume-event ${runId}`);
    createRun(createInitialState(runId, nowIso()));
    printJson({ runId });
  },

  // wf list → every run with its phase, last update and failure (used by /resume-event without a run id).
  list: () => {
    printJson(
      // One broken run is reported next to the others instead of hiding them all (F12).
      listRunIds().map((runId) => {
        try {
          const state = loadState(runId);
          return { runId, phase: state.phase, updatedAt: state.updatedAt, failure: state.failure };
        } catch (error) {
          return { runId, error: error instanceof Error ? error.message : String(error) };
        }
      }),
    );
  },

  // wf status <runId> → a readable overview of agents, gates and the execution plan.
  status: ([runId]) => {
    printText(formatStatus(requireRun(runId)));
  },

  // wf next <runId> [--resume] → the next action as JSON; the coordinator does exactly that and asks again.
  next: ([runId, flag]) => {
    const action = updateRun(runId, (state) => {
      const computed = nextAction(state, readApproval(state.runId));
      const isResume = flag === RESUME_FLAG;
      if (isResume) appendLog(state, "resume", { next: computed.action }, nowIso());
      // F18: an unchanged phase needs no write, which keeps next from competing with hooks for the state file.
      const isChanged = isResume || state.phase !== computed.action;
      state.phase = computed.action;
      return { isChanged, result: computed };
    });
    printJson(action);
  },
};
