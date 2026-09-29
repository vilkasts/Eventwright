// UserPromptSubmit срабатывает на сырой текст, набранный ЧЕЛОВЕКОМ, до раскрытия slash-команды.
// Это единственный писатель approval.json: модель не может подделать одобрение.
import { HASH_PREVIEW_LENGTH } from "@/config/workflow";
import { recordDecision } from "@/io/approval-store";
import { nowIso } from "@/io/clock";
import { blockPrompt, readHookInput, reportToContext } from "@/io/hook-io";
import { stateExists } from "@/io/state-store";
import { parseApprovalCommand } from "@/lib/approval-command";
import type { DecisionRequest } from "@/types/approval";

const SOURCE = "record-approval";

const recordApproval = async (): Promise<void> => {
  const command = parseApprovalCommand((await readHookInput()).prompt ?? "");
  if (command === null) return;
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

await recordApproval();
