# Validation report — domain

## Meta

- Run: 2026-09-29-lisbon-40th-birthday
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
| G7-budget-within-limit | PASS | catering-planner, entertainment-planner, logistics-planner, venue-scout, budget-aggregator | — |
| G8-currency-consistent | PASS | catering-planner, entertainment-planner, logistics-planner, venue-scout, budget-aggregator | — |
| G9-must-haves-covered | PASS | venue-scout, catering-planner, entertainment-planner, logistics-planner | — |

## Details

All gates pass.

- G2: every venue, vendor and price in 03-06 carries a numbered source. Two URLs were opened with WebFetch. https://silk-club.com/events/ confirms wheelchair access, elevator, seated dinner up to 60, rooftop terrace, heating and covered areas, and hours from 19:00 Tuesday to Saturday. https://www.fixthemusic.com/lisbon-acoustic-duo-portugal shows an average price of 1016 EUR.
- G4: the recommended venue seats up to 60 for 30 guests and states wheelchair access. The line `Public holidays: 2027-06-10 National Day (national, 2 days before)` matches a fresh holidays call for PT 2027. No holiday falls on the event date, and 2027-06-12 is a Saturday, when the venue is open.
- G6: the verdict is outdoor-ok, so plan B is not mandatory. 05 and 06 include fallbacks anyway.
- G7: `wf budget` returned total 8718.6 EUR against a limit of 9000 EUR, `withinLimit` true, no issues.
- G8: every amount in 03-07 is in EUR.
- G9: the [MUST] items are covered by concrete items. R-08 is met by SILK Club with an adapted taxi, R-06 and R-07 by the named dishes in 04, and R-05 by the duo in 05.
- Minor note, not a failure: one Sources entry in 03 (eventflare) is unnumbered. It backs no claim or price.
