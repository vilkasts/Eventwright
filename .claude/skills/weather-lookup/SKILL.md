---
name: weather-lookup
description: How to get grounded weather for an event date and place via the Open-Meteo MCP server — geocoding, choosing forecast vs. 10-year climatology, computing rain risk and the outdoor verdict. Use for any weather statement in the Eventwright workflow.
---

# weather-lookup

Weather comes only from the `open-meteo` MCP server (no API key). Tools: `mcp__open-meteo__geocoding`, `mcp__open-meteo__weather_forecast`, `mcp__open-meteo__weather_archive`.

## Procedure

1. **Geocode** the city from `- City:` → take the top result's latitude, longitude, timezone. Record them in `## Location`.
2. **Pick the method** from days until the event (`- Date:` minus `Today` given by the coordinator):
   - `≤ 14 days` → **forecast**: `weather_forecast` with `daily = temperature_2m_max, temperature_2m_min, precipitation_probability_max, precipitation_sum, sunset` for the event date.
   - `> 14 days` → **climatology**: `weather_archive` for the same calendar window (event date ± 3 days) in each of the last **10** full years, `daily = temperature_2m_max, temperature_2m_min, precipitation_sum, sunset`.
3. **Compute**:
   - forecast: rain risk = `precipitation_probability_max` of the event day.
   - climatology: rain risk = share of days with `precipitation_sum ≥ 1.0 mm` across all fetched days (e.g. 17 of 70 → 24%). Also mean max/min temperature and typical sunset.
4. **Verdict** (exact tokens):
   - rain risk `< 20%` and mean max between 15 °C and 32 °C → `outdoor-ok`
   - rain risk `20–45%`, or temperature outside that band → `outdoor-with-plan-b`
   - rain risk `> 45%` → `indoor-recommended`
5. **Write required lines** in `## Method` / `## Outdoor suitability`:
   - `- Method: forecast` or `- Method: climatology-10y`
   - `- Rain risk: <integer>%`
   - `- Verdict: outdoor-ok | outdoor-with-plan-b | indoor-recommended`
6. **Cite** every call in `## Sources`: `- open-meteo:weather_archive — lat 38.72, lon -9.14, 2016–2025, Jun 9–15`.

The server rounds request coordinates (≈0.1°) and answers for its nearest grid cell — record the `latitude`/`longitude` echoed in the response, not the ones you sent.

Never state weather numbers that did not come from these calls.
