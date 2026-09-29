---
name: holiday-lookup
description: How to check public holidays around the event date via the holidays MCP server (Nager.Date) and turn them into a grounded date-context line for venue availability, prices and booking. Use for any statement about holidays in the Eventwright workflow.
---

# holiday-lookup

Holidays come only from the `holidays` MCP server (Nager.Date, no API key). Tool: `mcp__holidays__get_holidays` with `country_code` (ISO 3166-1 alpha-2, e.g. `PT`, `ES`, `FR`) and `year`.

## Procedure

1. Take the country from `- City: <city>, <country>` and the date from `- Date:`; convert the country to its ISO code.
2. Call `get_holidays` for the event year (and the neighbouring year when the event is within 3 days of Jan 1 or Dec 31).
3. Keep holidays within **±3 days** of the event date that apply to the event's region: `global: true` (national) or `counties` containing the region code of the city. Ignore holidays of other regions.
4. Write the required line in `## Accessibility and logistics`:
   - none found → `- Public holidays: none within ±3 days`
   - found → `- Public holidays: <YYYY-MM-DD> <English name> (<national|regional>, <on the event day | N days before | N days after>)`; several holidays are separated by `;`.
5. When a holiday falls on or next to the event date, say what it means for the recommended venue: open or closed that day (from the venue page, or "not stated on the venue page"), holiday surcharge, earlier booking needed, heavier traffic.
6. Cite the call in `## Sources`: `- holidays:get_holidays — <country code>, <year>`.

Nager.Date lists national and regional holidays but **not municipal ones** (e.g. a city's patron saint day). Do not claim "no holidays at all" — the line covers public holidays from this source only.

Never state a holiday that did not come from this call.
