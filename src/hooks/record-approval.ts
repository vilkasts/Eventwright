// UserPromptSubmit fires on the raw text typed by a HUMAN, before the slash command is expanded.
// This is the only writer of approval.json: the model cannot forge an approval.
import { HASH_PREVIEW_LENGTH } from "@/config/workflow";
import { recordDecision } from "@/io/approval-store";
import { nowIso } from "@/io/clock";
import { blockPrompt, readHookInput, reportToContext, runHookSafely } from "@/io/hook-io";
import { stateExists } from "@/io/state-store";
import { isDecisionAttempt, parseApprovalCommand } from "@/lib/approval-command";
import type { DecisionRequest } from "@/types/approval";

// The hook's name, shown in front of its messages.
const SOURCE = "record-approval";

// Ordinary prompts pass untouched. For an approval command: check the run and the feedback,
// record the decision, and tell the conversation what was recorded. Any problem blocks the prompt (exit 2).
const recordApproval = async (): Promise<void> => {
  const prompt = (await readHookInput()).prompt ?? "";
  const command = parseApprovalCommand(prompt);
  if (command === null) {
    if (isDecisionAttempt(prompt)) {
      blockPrompt(
        SOURCE,
        "Usage: /approve-event <runId> (nothing after it) or /reject-event <runId> <what to change>.",
      );
    }
    return;
  }
  if (!stateExists(command.runId)) {
    blockPrompt(SOURCE, `Run '${command.runId}' not found. List runs: npm run -s wf -- list`);
  }
  if (command.decision === "rejected" && command.feedback === null) {
    blockPrompt(SOURCE, `Add your feedback: /reject-event ${command.runId} <what to change>`);
  }
  const request: DecisionRequest =
    command.decision === "rejected"
      ? { decision: "rejected", feedback: command.feedback ?? "" }
      : { decision: "approved" };
  try {
    const current = recordDecision(command.runId, request, nowIso());
    const hash = current.planSha256.slice(0, HASH_PREVIEW_LENGTH);
    reportToContext(
      SOURCE,
      `${command.runId}: '${current.decision}' recorded for plan sha256 ${hash} (round ${current.round}).`,
    );
  } catch (error) {
    blockPrompt(SOURCE, error instanceof Error ? error.message : String(error));
  }
};

await runHookSafely(SOURCE, recordApproval);
