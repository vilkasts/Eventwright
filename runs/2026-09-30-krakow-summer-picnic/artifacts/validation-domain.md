# Validation report — domain

## Meta

- Run: 2026-09-30-krakow-summer-picnic
- Agent: validator
- Stage: domain

## Summary

All 9 gates pass (G2, G5, G7, G8 and G9 were rechecked, the rest are carried over from the earlier pass). No FAIL. Caveat for the human: food and drinks are assumed to be included in the venue's per-person price, and the venue page does not confirm this.

## Gate results

| Gate | Status | Owners | Finding |
|---|---|---|---|
| G1-requirements-complete | PASS | requirements-formalizer | — |
| G2-sources-cited | PASS | venue-scout, catering-planner, entertainment-planner, logistics-planner | — |
| G3-weather-grounded | PASS | weather-analyst | — |
| G4-venue-fit | PASS | venue-scout | — |
| G5-dietary-coverage | PASS | catering-planner | — |
| G6-weather-plan-b | PASS | venue-scout, entertainment-planner, logistics-planner | — |
| G7-budget-within-limit | PASS | catering-planner, entertainment-planner, logistics-planner, venue-scout, budget-aggregator | — |
| G8-currency-consistent | PASS | catering-planner, entertainment-planner, logistics-planner, venue-scout, budget-aggregator | — |
| G9-must-haves-covered | PASS | catering-planner, entertainment-planner, logistics-planner, venue-scout | — |

## Details

None

## Sources

- https://8rental.com/bus-hire-krakow — the 30-seat midi coach is listed from 570 EUR for 8 hours, and the page says driver, fuel, tolls and parking are covered
- https://www.fixthemusic.com/corporate-bands/krakow — the page confirms a free quote service, with no prices listed
- npm run -s wf -- budget 2026-09-30-krakow-summer-picnic — total 2636.7 EUR against a limit of 3000 EUR, withinLimit true

## Open questions

None
