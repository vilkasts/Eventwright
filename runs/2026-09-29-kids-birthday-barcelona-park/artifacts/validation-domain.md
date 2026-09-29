# Validation report — domain

## Meta

- Run: 2026-09-29-kids-birthday-barcelona-park
- Agent: validator
- Stage: domain

## Gate results

| Gate | Status | Owners | Finding |
|---|---|---|---|
| G1-requirements-complete | PASS | requirements-formalizer | — |
| G2-sources-cited | PASS | venue-scout, catering-planner, entertainment-planner, logistics-planner | — |
| G3-weather-grounded | PASS | weather-analyst | — |
| G4-venue-fit | PASS | venue-scout | — |
| G5-dietary-coverage | PASS | catering-planner | n/a (catering skipped) |
| G6-weather-plan-b | PASS | venue-scout, entertainment-planner, logistics-planner | — |
| G7-budget-within-limit | PASS | venue-scout, entertainment-planner, logistics-planner, budget-aggregator | — |
| G8-currency-consistent | PASS | venue-scout, entertainment-planner, logistics-planner, budget-aggregator | — |
| G9-must-haves-covered | PASS | venue-scout, entertainment-planner, logistics-planner | — |

## Details

No failures.

- G2: opened the Fiesta Privada page (capacity 60, 120 EUR per hour, 5-hour minimum, tables and chairs included, external speakers and DJs and confetti prohibited, Metro Urgel) and the Festial page (Carrer de València 137, Wednesday 10-14 at 125 EUR, Urgell L1). Both match 03, 05 and 06. The earlier contradictions are fixed.
- G6: verdict is indoor-recommended; the recommended venue is fully indoor, and 05 and 06 give plan B text.
- G7: `wf budget` gives total 781 EUR against limit 1500 EUR, withinLimit true.
- G8: all amounts in 03 to 07 are in EUR.
- G9: no [MUST] tags in 01. R-08 lists a tent, which is deliberately not rented because the venue is indoor; the plan builder should explain this in the requirements matrix.
