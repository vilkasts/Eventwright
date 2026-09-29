# Catering plan: Kraków company summer picnic

## Meta

- Run: 2026-09-30-krakow-summer-picnic
- Agent: catering-planner
- Mode: retry
- Inputs: input.md, clarifications.md, artifacts/01-requirements.md, artifacts/03-venues.md

## Summary

In-house catering by the recommended venue Pałac Żeleńskich (Grodkowice) is planned as a buffet-style grill picnic in the tent and garden for 25 guests on 2027-07-10 (15:00-21:00), with non-alcoholic drinks only and one vegetarian guest covered. The venue page lists "food and drinks from the venue" among what is offered and publishes only one price, "from 199 PLN per person", which 03-venues.md already books as the venue cost (1140 EUR). To avoid double-counting and to keep the total within the 3000 EUR budget, this plan drops the separate catering line: food and non-alcoholic drinks are assumed to be covered by the venue's per-person price, so the separate catering cost is 0 EUR (share 1050 EUR, 35% of 3000 EUR). Caveat: the venue page does not state what the 199 PLN covers, and the dish names below are a proposed menu to be confirmed with the venue, not published items. If the venue charges food separately, the catering line has to be reopened (previous estimate: 40 EUR per person, 1000 EUR).

## Catering option

- Option: in-house menu of Pałac Żeleńskich (the venue lists food and drinks from the venue and catering among its services [1]), included in the venue's per-person price rather than billed as a separate line.
- External caterer: not chosen. The venue page does not state whether external food or suppliers are allowed [1], so an external caterer cannot be cited as permitted.
- Format: buffet-style grill picnic with seating in the white tent and garden [1]. Reason: a picnic is casual and outdoor, a buffet serves 25 guests over a six-hour window without a plated-service cost, one vegetarian option is simple to run as a separate grill line, and the covered tent allows serving in rain (weather verdict indoor-recommended, 61% rain risk, see 03-venues.md).
- Alcohol: none, as required (R-07).
- Service window: food from about 16:00, dessert and coffee at about 19:30, drinks throughout 15:00-21:00.

## Menu

Dish names are a proposal for the venue to confirm; the venue page publishes no menu [1].

### Arrival (15:00)

- Welcome drinks: homemade lemonade, still and sparkling water, cold apple juice.

### Main buffet (from 16:00)

- Grilled chicken thighs with herbs and lemon.
- Grilled pork sausages (kiełbasa).
- Vegetarian grill line (cooked on separate grill surface): grilled halloumi, corn cobs, and vegetable skewers with zucchini, peppers and mushrooms.
- Sides for everyone (all vegetarian): potato salad with dill, green salad with cucumber and tomato, coleslaw, bread rolls with herb butter.

### Dessert (about 19:30)

- Seasonal fruit platter and a sheet cake or pastry selection.
- Coffee and tea.

### Drinks package (non-alcoholic)

- Unlimited lemonade, juices, water, coffee and tea during 15:00-21:00.

## Dietary coverage

| Restriction | Guests | Dishes that cover it |
| --- | --- | --- |
| Vegetarian | 1 | Vegetarian grill line (halloumi, corn cobs, vegetable skewers), potato salad, green salad, coleslaw, bread rolls, fruit platter |
| Non-alcoholic drinks only | 25 | Lemonade, juices, water, coffee and tea; no alcohol is served |
| Accessibility needs | 0 | None required |

Portion plan: 24 guests take the grill mains; the vegetarian guest takes the vegetarian line, and 2 extra vegetarian portions are prepared as a buffer. Cross-contact: the venue must confirm a separate grill surface.

## Cost

- Basis: the venue's "from 199 PLN per person" (about 45.6 EUR at 4.3653 PLN per EUR) [1] [2] is the only published price. It is booked once, as the venue cost of 1140 EUR in 03-venues.md, and is assumed to include the in-house food and non-alcoholic drinks listed on the venue page [1].
- Separate food and drinks line: dropped (savings option), 0 EUR.
- Service and staff: assumed included in the venue's per-person price (not stated on the venue page).
- Alcohol: 0 EUR
- Catering share: 35% of 3000 EUR = 1050 EUR; the separate catering line uses 0 EUR of it, and the unused share stays as contingency.
- Risk: if the venue confirms that 199 PLN per person is rental only, food and drinks would cost extra (previous estimate 40 EUR per person, 1000 EUR, within the 1050 EUR share, but the total budget would then be exceeded).
- Catering cost: 0 EUR

## Sources

- [1] https://venuu.com/pl/en/venues/palac-zelenskich-ogrod — venue lists food and drinks from the venue, catering, white tent, price from 199 PLN per person; no menu or rules on external food (accessed 2026-09-30, via 03-venues.md)
- [2] https://api.frankfurter.dev/v1/latest?base=EUR&symbols=PLN — 4.3653 PLN per EUR on 2026-09-29 (accessed 2026-09-30, via 03-venues.md)
- user-input — original request
- user-input — clarification round 1

## Open questions

- Does the venue's 199 PLN per person include food and drinks, and what does in-house catering cost if billed separately? To confirm with the venue when booking (no published data exists).
