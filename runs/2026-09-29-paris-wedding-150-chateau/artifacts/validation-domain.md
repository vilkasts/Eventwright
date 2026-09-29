# Validation report — domain

## Meta

- Run: 2026-09-29-paris-wedding-150-chateau
- Agent: validator
- Stage: domain

## Gate results

| Gate | Status | Owners | Finding |
|---|---|---|---|
| G1-requirements-complete | PASS | requirements-formalizer | — |
| G2-sources-cited | PASS | venue-scout, catering-planner, entertainment-planner, logistics-planner | — |
| G3-weather-grounded | PASS | weather-analyst | — |
| G4-venue-fit | PASS | venue-scout | — |
| G5-dietary-coverage | PASS | catering-planner | — |
| G6-weather-plan-b | PASS | venue-scout, entertainment-planner, logistics-planner | — |
| G7-budget-within-limit | FAIL | venue-scout, catering-planner, budget-aggregator | Total 20548 EUR vs limit 5000 EUR (withinLimit false); no single savings option covers the 15548 EUR overrun |
| G8-currency-consistent | PASS | venue-scout, catering-planner, entertainment-planner, logistics-planner, budget-aggregator | — |
| G9-must-haves-covered | PASS | venue-scout, catering-planner, entertainment-planner, logistics-planner | — |

## Details

### G7-budget-within-limit

`npm run -s wf -- budget` returned total 20548 EUR, limit 5000 EUR, `withinLimit: false`, no issues.

From 07-budget.md `## Savings options`, the largest levers are:
- "Switch the venue to Château de Breteuil (1800 EUR ...): saves 4100 EUR (4510 EUR with contingency)" (owner venue-scout).
- "At Breteuil any caterer is allowed, so an unapproved caterer such as Erwan Guillon Traiteur from 25 EUR per guest (3750 EUR, extras excluded) saves 8250 EUR (9075 EUR with contingency)" (owner catering-planner; depends on the venue switch).

Together these save at most 13585 EUR with contingency, so the total would still be about 6963 EUR, above 5000 EUR. No single planner can cover the overrun, so venue-scout, catering-planner and budget-aggregator are named. Even the combined options leave the plan over the limit, and Breteuil raises an R-08 accessibility question (G4). The budget of 5000 EUR looks infeasible for a 150-guest seated château wedding: the run needs a human decision (raise the budget, reduce guests, or relax R-08), which the coordinator should escalate since this gate is at 3 of 3 failures.

### Notes on passing gates (no action)

- G2: opened Hardricourt (bridebook) and Cirette (mariages.net); capacity 150, from 5900 EUR, disabled access, approved caterers, and 80-200 EUR per guest all match. The logistics decor line (60 EUR) is a labelled estimate without comparable URLs; minor.
- G4: capacity 150 matches guests; `- Public holidays: none within ±3 days` matches the fresh FR 2027 call (no holiday in September); orangery and ballroom provide covered space.
- G9: R-02 (château, Hardricourt) and R-04 (seated dinner, Cirette) have concrete items.
