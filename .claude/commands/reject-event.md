---
description: (Human only) Reject the current plan with feedback — it will be revised and submitted for approval again.
argument-hint: <runId> <what to change>
disable-model-invocation: true
---

The user rejected the plan. Arguments: `$ARGUMENTS` (the first word is the runId, the rest is the feedback). The `record-approval` hook has already recorded the rejection and marked the plan for revision.

You are the **coordinator**. Load skill `workflow-orchestration`, follow its section "After a rejection" (decide which upstream agents the feedback touches and run `invalidate` if needed), then continue the main loop for this runId.
