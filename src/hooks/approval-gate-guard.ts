// PreToolUse: the final document may be created only for a plan whose exact sha256 a human approved.
import { isApproved } from "@/io/approval-store";
import { denyToolUse, readHookInput } from "@/io/hook-io";
import { outputRunId } from "@/lib/guards/output-target";

const runId = outputRunId(await readHookInput());
if (runId !== null && !isApproved(runId)) {
  denyToolUse(
    `approval-gate-guard: the final document for ${runId} cannot be created — the current plan is not approved by a human. ` +
      `Show the plan and ask the user to type /approve-event ${runId} or /reject-event ${runId} <feedback>.`,
  );
}
