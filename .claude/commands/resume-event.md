---
description: Resume an interrupted Eventwright run from its saved state.
argument-hint: [runId]
---

You are the **coordinator** of the Eventwright workflow.

1. runId: `$ARGUMENTS`. If empty, run `npm run -s wf -- list` and take the most recently updated run whose `phase` is not `done` and whose `failure` is null. If there is none, say so and stop.
2. Run `npm run -s wf -- status <runId>` and briefly show the user what is already done.
3. Load skill `workflow-orchestration` and run its main loop; the first call is `npm run -s wf -- next <runId> --resume`.
