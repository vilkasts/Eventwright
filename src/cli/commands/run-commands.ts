import type { CommandRegistry } from "@/cli/command";
import { requireRun } from "@/cli/require-run";
import { readApproval } from "@/io/approval-store";
import { nowIso, todayIso } from "@/io/clock";
import { printJson, printText } from "@/io/output";
import { createRun, listRunIds, loadState, saveState, stateExists } from "@/io/state-store";
import { nextAction } from "@/lib/next-action";
import { appendLog, createInitialState } from "@/lib/state";
import { formatStatus } from "@/lib/status-report";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESUME_FLAG = "--resume";

// Жизненный цикл run: создание, список, статус и вычисление следующего шага.
export const RUN_COMMANDS: CommandRegistry = {
  init: ([slug = ""]) => {
    if (!SLUG.test(slug)) throw new Error("slug must be lowercase kebab-case, e.g. lisbon-birthday");
    const runId = `${todayIso()}-${slug}`;
    if (stateExists(runId)) throw new Error(`Run ${runId} already exists — use /resume-event ${runId}`);
    createRun(createInitialState(runId, nowIso()));
    printJson({ runId });
  },

  list: () => {
    printJson(
      listRunIds().map((runId) => {
        const state = loadState(runId);
        return { runId, phase: state.phase, updatedAt: state.updatedAt, failure: state.failure };
      }),
    );
  },

  status: ([runId]) => {
    printText(formatStatus(requireRun(runId)));
  },

  next: ([runId, flag]) => {
    const state = requireRun(runId);
    const action = nextAction(state, readApproval(state.runId));
    if (flag === RESUME_FLAG) appendLog(state, "resume", { next: action.action }, nowIso());
    state.phase = action.action;
    saveState(state);
    printJson(action);
  },
};
