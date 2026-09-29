---
name: web-research
description: How Eventwright agents research real vendors, venues and prices on the web — search, verify by opening the page, capture price with date and currency, cite. Use whenever an artifact contains a vendor, venue, price or availability claim.
---

# web-research

The model's memory is not a source. Every vendor, venue and price must come from a page you opened in this run.

## Procedure

1. **Search** with WebSearch using the city + category + qualifier from the requirements, e.g. `garden restaurant private dining 30 guests Lisbon`, `vegetarian catering menu price per person Lisbon`. Run 2–4 queries with different wording.
2. **Open** the 3–6 most relevant results with WebFetch. Prefer the vendor's own site; aggregators (maps, booking, event marketplaces) are acceptable for price ranges.
3. **Capture** for each candidate: name, URL, what the page states (capacity, price, package contents, accessibility), the currency on the page, and today's date.
4. **Convert** currencies only when the page's currency differs from the requirements' currency: note the rate and its source URL in `## Sources`.
5. **Estimate honestly**: when a page gives a range or "from" price, use the upper end for budgeting and say so. When no price is published, write `price on request` and estimate from comparable vendors, labelled `estimate` with their URLs.
6. **Cite**: numbered sources `- [N] https://… — what was taken (accessed YYYY-MM-DD)` and refer to `[N]` next to each claim.

## Rules

- Never invent a vendor, URL, price, capacity or accessibility feature.
- Exclude candidates that clearly violate a `[MUST]` requirement; mention them only if nothing compliant exists.
- Keep sorting deterministic: rank by requirement fit, then by price ascending, then by name.
