# Validation report — domain

## Meta

- Run: 2026-09-29-new-year-team-party
- Agent: validator
- Stage: domain

## Gate results

| Gate | Status | Owners | Finding |
|---|---|---|---|
| G1-requirements-complete | PASS | requirements-formalizer | — |
| G2-sources-cited | PASS | venue-scout, catering-planner | — |
| G3-weather-grounded | PASS | weather-analyst | — |
| G4-venue-fit | PASS | venue-scout | — |
| G5-dietary-coverage | PASS | catering-planner | — |
| G6-weather-plan-b | PASS | venue-scout | — |
| G7-budget-within-limit | PASS | venue-scout, catering-planner, budget-aggregator | — |
| G8-currency-consistent | PASS | venue-scout, catering-planner, budget-aggregator | — |
| G9-must-haves-covered | PASS | venue-scout, catering-planner | — |

## Details

No failures. Checks performed:

- G2: fetched venuu.com Pół na Pół page (80 seated, 120 standing, heating, own food and alcohol, late events, parking confirmed) and the photo booth page (Impreza 1050 PLN for 3h, VIP 1250 PLN for 4h confirmed). Catering plans venue food, which the venue rules allow.
- G3: climatology-10y with 93 days to the event is correct. Re-ran weather_archive for 2024-12-28 to 2025-01-03: 2 rainy days of 7 and mean max about 4.3 C, matching the artifact (2 days, 4.3 C).
- G4: capacity 80 is at least 41 and sourced; includes and rules sourced; no accessibility requirements; the heated indoor studio covers all guests. Holidays call for PL 2027 returned New Year's Day on 2027-01-01 (1 day after; Epiphany is 6 days after, outside the window), which matches; the artifact addresses it.
- G7: `wf budget` returned withinLimit true (5373.5 EUR against 8000 EUR).
- G6 and G9: the indoor studio is the plan B for all guests; the photo booth and all MUST items (R-02, R-05) are covered in 03.
- Entertainment and logistics are skipped by the execution plan and were not checked.
