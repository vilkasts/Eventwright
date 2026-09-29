# Run B — Clarification, interruption and resume, rejection and re-approval

## Goal

Start from an almost empty request, collect the missing facts from the human, survive an interrupted session, and handle a rejection that changes upstream work before approving the revised plan.

## Input

```
/plan-event Organize our team's New Year party.
```

## What the human did

1. Answered the clarifying questions (Warsaw, 2026-12-31, 41 guests, budget, services `venue, catering`).
2. Closed Claude Code while the requirements were being finalized, started a new session and typed `/resume-event 2026-09-29-new-year-team-party`.
3. At approval typed `/reject-event 2026-09-29-new-year-team-party Use the second venue from the shortlist and add a photo booth`.
4. Confirmed the revised requirements, then typed `/approve-event 2026-09-29-new-year-team-party`.

## Key events (from `workflow-state.json → log`)

| Time (UTC) | Event |
| --- | --- |
| 15:58–16:00 | requirements-formalizer draft; clarification; the session was interrupted during finalize |
| 16:00 | `resume` — only the interrupted formalizer was restarted; finished work was not repeated |
| 16:03–16:07 | weather (climatology, `outdoor-with-plan-b`), venue-scout, catering-planner, budget-aggregator (entertainment and logistics skipped — not requested) |
| 16:08 | domain gates: **G2** and **G4** fail — a "heated, covered winter garden" claim was not on the cited venue page |
| 16:08–16:10 | targeted retries of venue-scout and its downstream; domain gates 9/9 pass |
| 16:11 | final gates: **G12** fails — a checklist deadline fell on the event day; event-plan-builder retried; final gates pass |
| 18:20 | `approval-rejected` (round 1) recorded by the UserPromptSubmit hook |
| 18:24 | `invalidated`: requirements-formalizer and venue-scout with the user's feedback (logged twice — issued by hand and by the coordinator) |
| 18:24–18:30 | formalizer revised; requirements re-confirmed (18:25); new execution plan; 01–08 regenerated; all gates pass in one pass |
| 18:38 | `approval-approved` (round 2) |
| 18:39 | html-builder — final documents written |

`approval.json → history` holds both rounds: rejected (first plan hash) and approved (revised plan hash).

## Outcome

`phase: done`. Venue: Pół na Pół (Fort Mokotów) — the second venue of the shortlist. Total with contingency 5373.5 EUR within the 8000 EUR limit.

## What it demonstrates

- Collecting, recording (`clarifications.md`) and confirming missing information.
- Resumable state: after the interruption only the unfinished agent re-ran.
- Rejection → coordinator invalidates the upstream owners → downstream regenerates → new approval round.
- Gates catching invented facts (G2/G4) and an infeasible deadline (G12), each fixed by a targeted retry.

## Issues found and fixed afterwards

- The answer "more than 8000 EUR" was recorded as the ceiling `- Budget: 8000 EUR`. Fixed: an open-ended budget answer triggers a question for a concrete maximum.
- The photo booth was priced by venue-scout as a venue add-on; `entertainment` was not added to the services. Fixed: feedback that needs a skipped service adds that service.
- A `[MUST]` terrace requirement was satisfied by an indoor winter garden and G9 passed "with a caveat". Fixed: `[MUST]` requirements are checked literally.
- The same `invalidate` was issued twice (by hand and by the coordinator). Fixed: a repeated identical invalidation is a no-op.
