# Budget: Kraków company summer picnic

## Meta

- Run: 2026-09-30-krakow-summer-picnic
- Agent: budget-aggregator
- Mode: retry
- Inputs: input.md, clarifications.md, artifacts/01-requirements.md, artifacts/03-venues.md, artifacts/04-catering.md, artifacts/05-entertainment.md, artifacts/06-logistics.md

## Summary

The four planned services add up to 2397 EUR; with a 10% contingency the total is 2636.70 EUR against a limit of 3000 EUR, so the plan is within budget. All amounts are in EUR and are copied from the planner artifacts. The catering artifact now drops the separate catering line because food and non-alcoholic drinks are assumed to be included in the venue's per-person price, which avoids double-counting. Most prices are estimates or "from" prices.

## Line items

| Category | Item | Amount | Source artifact section |
| --- | --- | --- | --- |
| Venue | Pałac Żeleńskich, 25 guests x 199 PLN per person (4975 PLN), assumed to include food and drinks | 1140 EUR | 03-venues.md, Recommendation (Venue cost) |
| Catering | Included in the venue per-person price, no separate line | 0 EUR | 04-catering.md, Cost (Catering cost) |
| Entertainment | Live band, 3 sets of 165 minutes in total (estimate, 3000 PLN) | 687 EUR | 05-entertainment.md, Cost (Entertainment cost) |
| Logistics | 30-seat midi coach with driver, 8 hours, plus 0 EUR rentals | 570 EUR | 06-logistics.md, Cost (Logistics cost) |

## Totals

- Subtotal: 2397 EUR
- Contingency (10%): 239.70 EUR
- Total with contingency: 2636.70 EUR
- Budget limit: 3000 EUR

The plan is within budget, with 363.30 EUR of headroom.

## Savings options

Not needed

## Sources

- user-input — original request
- user-input — clarification round 1
- artifacts/01-requirements.md — budget limit 3000 EUR and requirement ids
- artifacts/03-venues.md — venue cost 1140 EUR
- artifacts/04-catering.md — catering cost 0 EUR and the risk that the venue price excludes food
- artifacts/05-entertainment.md — entertainment cost 687 EUR
- artifacts/06-logistics.md — logistics cost 570 EUR

## Open questions

- Does the venue's 199 PLN per person include food and drinks? If not, the catering line (previous estimate 1000 EUR) must be reopened and the plan would exceed the limit. To confirm with the venue when booking.
