# Run D — Unresolvable gate failure stops the run

## Goal

Requirements that cannot all be met: the budget gate must fail repeatedly, stop the run after the retry limit, block all dependent work and produce a clear failure report instead of a plan.

## Input

```
/plan-event Wedding for 150 guests in Paris on 2027-09-18. Total budget 5000 EUR. It MUST be in a château and MUST include a full seated dinner.
```

## What the human did

1. Answered two rounds of clarifying questions and confirmed the requirements.
2. Nothing else — no plan reached the approval step.

## Key events (from `workflow-state.json → log`)

| Time (UTC) | Event |
| --- | --- |
| 18:50–18:52 | requirements-formalizer draft, clarifications, finalize; requirements confirmed; all four planners selected |
| 18:52 | weather-analyst — climatology, `outdoor-with-plan-b` |
| 18:53–18:56 | venue-scout; catering ∥ entertainment ∥ logistics; budget-aggregator |
| 18:57 | domain gates: **G7** fails (attempt 1) |
| 18:58–19:01 | retry: venue-scout and the three planners, budget; **G7** fails (attempt 2), G4 also fails |
| 19:01–19:03 | retry; **G7** fails (attempt 3), G2 and G4 also fail |
| 19:04–19:07 | retry; G2 and G4 now pass, **G7** fails a 4th time → status `blocked` |

The validator re-ran all planners because no single savings option could cover the overrun.

## Outcome

`phase: failed`, `failure: {kind: "gate", gate: "G7-budget-within-limit", attempts: 4}`. Last total with contingency 20548 EUR against the 5000 EUR limit; even the cheapest château and caterer combination was about 6963 EUR.

Not run, by design: event-plan-builder, the final gates G10–G12, human approval and html-builder. There is no `08-event-plan.md`, no `approval.json` and no `output/` folder.

The coordinator's failure report named the blocked gate and its attempts, listed the steps that did not run, and suggested how to relax the conflict: raise the budget to at least about 7000 EUR, cut the guest count, or loosen one of the `[MUST]` requirements.

## What it demonstrates

- The retry limit: 3 consecutive failures are retried, the 4th blocks the gate.
- An unresolved failure stops all dependent work and is reported explicitly.
- Gates G1–G6, G8 and G9 still pass: the stop is caused by the budget alone.
