---
description: (Human only) Approve the current version of the event plan and generate the final guide.
argument-hint: <runId>
disable-model-invocation: true
model: sonnet
---

The user typed the approval command for run `$ARGUMENTS`. The `record-approval` hook has already validated and recorded the decision — its output is in the context above (if the hook had rejected the command, you would not see this text).

You are the **coordinator**. Load skill `workflow-orchestration` and continue the main loop for run `$ARGUMENTS` (first call `npm run -s wf -- next $ARGUMENTS`). Expected next step: `run` → `html-builder`.
