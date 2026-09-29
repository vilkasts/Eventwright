# Run C — Dynamic agent selection and forecast weather

## Goal

A request that does not need every service: the organizer brings the food, so the catering planner must be skipped and its gate must become not applicable. The event is a week away, so the weather must come from the forecast instead of climatology.

## Input

```
/plan-event Kids' birthday party (8 years old) in Barcelona on 2026-10-07, 15 kids and 10 adults, outdoor park party, budget 1500 EUR. We will bring our own food and drinks.
```

## What the human did

1. Answered two rounds of clarifying questions and confirmed the requirements with `- Services: venue, entertainment, logistics`.
2. Typed `/approve-event 2026-09-29-kids-birthday-barcelona-park` when the plan was shown.

The interruption-and-resume scenario was planned for this run but was demonstrated in Run B instead.

## Key events (from `workflow-state.json → log`)

| Time (UTC) | Event |
| --- | --- |
| 15:25–15:29 | requirements-formalizer draft, two clarification rounds, finalize; requirements confirmed (15:29) |
| 15:29 | `execution-plan`: catering-planner **skipped**, gate G5 `n/a` |
| 15:30 | weather-analyst — `Method: forecast` (8 days ahead), rain risk 63%, `Verdict: indoor-recommended` |
| 15:31 | venue-scout; then entertainment-planner ∥ logistics-planner (catering not started); budget-aggregator |
| 15:36 | domain gates: **G4** fails — the recommended venue had no published capacity |
| 15:36–15:38 | venue-scout retry picked another venue; entertainment, logistics and budget regenerated as downstream |
| 15:40 | domain gates: **G2** fails — logistics rented furniture the venue already includes; entertainment planned a speaker and confetti the venue forbids |
| 15:40–15:42 | targeted retries of the two planners and the budget; domain gates pass |
| 15:43–15:44 | event-plan-builder; final gates pass |
| 15:45 | `approval-approved` (round 1); html-builder |

## Outcome

`phase: done`. Indoor venue Fiesta Privada Barcelona, 600 EUR; total with contingency 781 EUR within the 1500 EUR limit. The Menu section of the plan states that food is handled by the organizer.

## What it demonstrates

- Model-driven dynamic selection of subagents: the confirmed `- Services:` line decides which planners run; the skipped agent is never started and its gate is `n/a`.
- The weather method adapts to the lead time (forecast for ≤ 14 days).
- An `indoor-recommended` verdict drives the venue choice and the plan B.

## Issues found and fixed afterwards

- The venue facts other planners depend on were missing, which caused both the G4 and the G2 failure. Fixed: `03-venues.md` must state `- Venue capacity:`, `- Venue includes:` and `- Venue rules:` (enforced by the structure check), and the planners start from them.
- The validator re-ran web and MCP checks for gates that had already passed. Fixed: web and MCP calls only for gates that need a re-check.
