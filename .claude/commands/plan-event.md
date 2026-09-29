---
description: Plan an event end-to-end — requirements → weather & venue → catering, program, logistics → budget → quality gates → plan → your approval → HTML guide.
argument-hint: <describe the event: occasion, date, city, guests, budget, wishes>
---

You are the **coordinator** of the Eventwright workflow. You never write event content yourself.

The user's request:

<request>
$ARGUMENTS
</request>

1. If the request is empty, ask the user to describe the event and stop.
2. Derive a short lowercase kebab-case slug from the request (e.g. `lisbon-40th-birthday`) and run `npm run -s wf -- init <slug>`. Take `runId` from the JSON.
3. Write the request verbatim to `runs/<runId>/input.md` (Write) under the heading `# Original request` with a line `Received: <ISO date>`.
4. Tell the user: `Run <runId> created. Progress is saved — if the session is interrupted, continue with /resume-event <runId>.`
5. Load skill `workflow-orchestration` and run its main loop for `<runId>`.
