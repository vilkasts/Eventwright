# Run A — Happy path with targeted retries

## Goal

A complete event with every service requested: 10-year weather climatology, all four planners (catering, entertainment and logistics in parallel), quality gates, human approval and the final HTML guide.

## Input

```
/plan-event 40th birthday dinner in Lisbon on 2027-06-12 for 30 guests. Budget 9000 EUR. Rooftop or garden restaurant, live acoustic music, 3 vegetarians and 1 gluten-free guest, one guest uses a wheelchair.
```

## What the human did

1. Answered one round of clarifying questions and confirmed the requirements.
2. Typed `/approve-event 2026-09-29-lisbon-40th-birthday` when the plan was shown.

## Key events (from `workflow-state.json → log`)

| Time (UTC) | Event |
| --- | --- |
| 14:14–14:22 | requirements-formalizer: draft, clarification round, finalize; requirements confirmed (14:22); execution plan: all agents selected |
| 14:22 | weather-analyst — `Method: climatology-10y`, rain risk 6%, `Verdict: outdoor-ok` |
| 14:23 | venue-scout — SILK Club (rooftop), 3000 EUR; holidays MCP: `2027-06-10 National Day (national, 2 days before)` |
| 14:25 | catering-planner ∥ entertainment-planner ∥ logistics-planner launched in one group |
| 14:26 | budget-aggregator |
| 14:28 | domain gates: 7 pass, **G2** (entertainment prices not on the cited page) and **G7** (9080.5 EUR vs 9000 EUR limit) fail |
| 14:28–14:32 | targeted retries: only the owners of G2/G7 and their downstream re-ran |
| 14:33 | domain gates: 9/9 pass |
| 14:33–14:34 | event-plan-builder; final gates G10–G12 pass |
| 14:35 | `approval-approved` (round 1), bound to the plan's sha256 |
| 14:35 | html-builder — `output/event-plan.md`, `output/event-plan.html` |

## Outcome

`phase: done`. Total with 10% contingency 8718.6 EUR within the 9000 EUR limit. Final document: `output/event-plan.html`.

## What it demonstrates

- Hub-and-spoke coordinator with dependency groups and a parallel group of three planners.
- Both MCP servers: Open-Meteo archive (10-year climatology) and public holidays (Nager.Date).
- Named quality gates with targeted retries — only failing owners and their downstream re-ran.
- Deterministic human approval bound to the plan hash.

## Issues found and fixed afterwards

- entertainment-planner once wrote its artifact through Python in Bash, so the write was not recorded and the structure check passed on the old file. Fixed: `lint`/`check` now reject an agent that was started but whose Write was never recorded, and every agent must write only with the Write tool.
- G7 overran by 80.5 EUR and all three planners were re-run. Fixed: planners get budget shares, and a G7 failure names a single owner when one savings option covers the overrun.
