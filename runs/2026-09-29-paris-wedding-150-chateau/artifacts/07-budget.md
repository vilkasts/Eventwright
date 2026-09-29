# Budget

## Meta
- Run: 2026-09-29-paris-wedding-150-chateau
- Agent: budget-aggregator
- Mode: retry
- Inputs: input.md, clarifications.md, artifacts/01-requirements.md, artifacts/03-venues.md, artifacts/04-catering.md, artifacts/05-entertainment.md, artifacts/06-logistics.md

## Summary
Retry after the venue changed to Château d'Hardricourt (03-venues.md) and catering was re-priced at its approved caterer (04-catering.md). The four services add up to 18680 EUR; with the 10% contingency the total is 20548 EUR against a limit of 5000 EUR, so the plan is over budget by 15548 EUR. All prices are published from-prices or floors of ranges, not quotes for 2027-09-18, so the real total is likely higher. Prices are copied from the planner artifacts and not changed here.

## Line items
| Category | Item | Amount | Source artifact section |
| --- | --- | --- | --- |
| Venue | Château d'Hardricourt, exclusive use (from-price) | 5900 EUR | 03-venues.md, Recommendation |
| Catering | Cirette Traiteur, seated dinner, 80 EUR x 150 guests (floor of 80-200 EUR range) | 12000 EUR | 04-catering.md, Cost |
| Entertainment | DJ and MC package, Soirées dansantes (8 hours, sound and lighting) | 600 EUR | 05-entertainment.md, Cost |
| Logistics | Patio heater rental (120 EUR) and decor estimate (60 EUR) | 180 EUR | 06-logistics.md, Cost |

## Totals
- Subtotal: 18680 EUR
- Contingency (10%): 1868.00 EUR
- Total with contingency: 20548 EUR
- Budget limit: 5000 EUR

The plan is over budget by 15548 EUR (the total with contingency is 411% of the limit).

## Savings options
The plan is over the limit. To reach 5000 EUR with contingency the subtotal must fall to about 4545 EUR, a cut of about 14135 EUR before contingency. No set of cuts that keeps the [MUST] requirements (R-02 château, R-04 full seated dinner) closes this gap with the current venue; the client must decide on the budget, the guest count or the venue.
- Switch the venue to Château de Breteuil (1800 EUR, listed in 03-venues.md): saves 4100 EUR (4510 EUR with contingency); touches R-08 (step-free access to its dining space is not confirmed), still a château so R-02 is kept.
- At Breteuil any caterer is allowed, so an unapproved caterer such as Erwan Guillon Traiteur from 25 EUR per guest (3750 EUR, extras excluded) saves 8250 EUR (9075 EUR with contingency); touches R-04 (seated dinner scope and extras unconfirmed), no [MUST] dropped. This option depends on the venue switch above.
- Drop the patio heater: saves 120 EUR; touches R-08 (comfort of seniors) only.
- Drop the decor lot and use the natural garden setting: saves 60 EUR; touches R-10 (decor).

## Sources
- user-input — original request
- user-input — clarification round 1
- user-input — clarification round 2

## Open questions
None
