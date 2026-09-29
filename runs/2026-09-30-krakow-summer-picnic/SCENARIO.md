# Run E — Regression run after the code review

## Goal

Exercise every fix of the final code review in a live run: all four services, so that each planner, the validator and the HTML builder write through the new artifact-ownership guard; a parallel group of three agents finishing at once (run lock against lost state updates); the new required venue lines and money-line checks; the check that `record-gates` accepts only a report written by the validator; and a budget retry that re-runs a single owner.

## Input

```
/plan-event Company summer picnic in Kraków on 2027-07-10 for 25 people. Budget 3000 EUR. Outdoor with food, a live band and a shuttle from the office, one vegetarian guest
```

Session started with `npm run claude:run` (project settings and MCP only, Sonnet coordinator, `acceptEdits`).

## What the human did

1. Answered one round of five clarifying questions (office on the city outskirts, 15:00–21:00, a covered area is welcome, non-alcoholic drinks only, no accessibility needs) and confirmed requirements R-01…R-10.
2. Typed `/approve-event 2026-09-30-krakow-summer-picnic` when the plan was shown.

## Key events (from `workflow-state.json → log`)

| Time (UTC) | Event |
| --- | --- |
| 11:41–11:46 | requirements-formalizer: draft, clarification round, finalize; requirements confirmed; execution plan: all four planners selected |
| 11:46 | weather-analyst — `Method: climatology-10y` (283 days ahead), rain risk 61%, `Verdict: indoor-recommended` |
| 11:47–11:50 | venue-scout — Pałac Żeleńskich (Grodkowice), garden tent; `Venue capacity`, `Venue includes`, `Venue rules`, `Public holidays: none within ±3 days` |
| 11:50–11:51 | catering ∥ entertainment ∥ logistics in one group; all three writes recorded within 8 seconds, all structure checks pass first time |
| 11:51 | budget-aggregator — total with contingency about 3737 EUR against the 3000 EUR limit |
| 11:52 | domain gates: 8 pass, **G7** fails |
| 11:52–11:53 | targeted retry of **catering-planner only** (the single owner whose change covers the overrun), then budget-aggregator — total 2636.70 EUR |
| 11:53 | domain gates: 9/9 pass |
| 11:53–11:55 | event-plan-builder; final gates G10–G12 pass |
| 11:57 | `approval-approved` (round 1) |
| 11:57 | html-builder — `output/event-plan.md`, `output/event-plan.html` |

## Outcome

`phase: done`. Venue cost 1140 EUR, entertainment 687 EUR, logistics 570 EUR, catering 0 EUR (see the limitation below); subtotal 2397 EUR, total with 10% contingency 2636.70 EUR within the 3000 EUR limit. Final document: `output/event-plan.html` — 9 sections, 15 external source links.

## What it demonstrates

- The review fixes working live: no lost state update in the parallel group (run lock), every artifact written by its owner (ownership guard), the new venue lines and money formats accepted by the structure check, the validator's report accepted by `record-gates` on the first pass.
- A G7 failure re-runs one owner instead of every planner.
- Faster than runs A–D: about 16 minutes including the human's answers, with one retry.

## Known limitation shown by this run: a budget that fits by assumption

The venue publishes only "from 199 PLN per person" and does not say what the price covers; venue-scout recorded exactly that. When G7 failed, catering-planner was retried with the reason "reduce the cost" and resolved it by assuming the in-house food and drinks are included in the venue's per-person price, setting `- Catering cost: 0 EUR`. The assumption is stated openly in `04-catering.md` (basis, risk, open question) and in the plan, but G2 and G7 both passed: G2 because the source does list "food and drinks from the venue", G7 because the arithmetic fits.

Each agent was honest, yet together the retry steered the result towards the reading that makes the gate pass. It also used the lower bound of a "from" price, while skill `web-research` asks for a conservative estimate. If food is billed separately, the plan exceeds the limit (the margin is 363.30 EUR). G7 proves that the numbers in the artifacts add up — not that those numbers are confirmed prices. Confirm the price basis with the venue before booking.

A possible future fix: allow a cost of 0 or "included in another price" only when the source states the inclusion, otherwise require a sourced estimate — and have the validator fail G2/G7 on unsourced inclusions.
