# Weather outlook: Kraków, 2027-07-10

## Meta

- Run: 2026-09-30-krakow-summer-picnic
- Agent: weather-analyst
- Mode: initial
- Inputs: input.md, clarifications.md, artifacts/01-requirements.md

## Summary

The event is 283 days away, so only climatology is possible. Across 2016–2025 (July 7–13), 43 of 70 days had at least 1.0 mm of rain (61%), with a mean daily maximum of 24.2 °C. Temperatures suit an outdoor picnic, but the rain risk is high, so the verdict is indoor-recommended and a covered area is needed.

## Location

- City: Kraków, Poland
- Geocoded coordinates: 50.06143, 19.93658
- Archive grid cell used: latitude 50.017574, longitude 19.947643 (elevation 220 m)
- Timezone: Europe/Warsaw (UTC+2 in July)

## Method

- Method: climatology-10y
- Why: the event date 2027-07-10 is 283 days after today (2026-09-30), which is more than 14 days, so no forecast is available.
- Period queried: the calendar window July 7–13 (event date ± 3 days) in each of the last 10 full years, 2016–2025, 70 days in total.
- Variables: temperature_2m_max, temperature_2m_min, precipitation_sum, sunset (timezone Europe/Warsaw).
- Rainy day: precipitation_sum of 1.0 mm or more.

## Outlook

| Metric | Value |
| --- | --- |
| Mean max temperature | 24.2 °C |
| Mean min temperature | 15.0 °C |
| Rain risk | 61% (43 of 70 days) |
| Typical sunset (local time) | 20:48 |

### Per-year detail (July 7–13)

| Year | Rainy days (of 7) | Mean max °C |
| --- | --- | --- |
| 2016 | 3 | 24.0 |
| 2017 | 6 | 24.2 |
| 2018 | 4 | 25.1 |
| 2019 | 4 | 20.7 |
| 2020 | 4 | 21.0 |
| 2021 | 4 | 28.4 |
| 2022 | 5 | 20.3 |
| 2023 | 3 | 28.0 |
| 2024 | 3 | 28.6 |
| 2025 | 7 | 21.3 |

## Outdoor suitability

- Rain risk: 61%
- Verdict: indoor-recommended

Temperatures are comfortable (mean max 24.2 °C, mean min 15.0 °C) and the sun sets around 20:48, so the whole 15:00–21:00 window is in daylight until near the end. Rain on at least 1 mm is likely on more than half of the days in this window, so an uncovered outdoor picnic is risky. The venue should be outdoors as requested but must have a covered or indoor fallback area for all 25 guests, the band, the food and the shuttle drop-off, with a firm rain-day decision point shortly before the event.

## Sources

- open-meteo:geocoding — Kraków, PL (lat 50.06143, lon 19.93658, Europe/Warsaw)
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2016, Jul 7–13
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2017, Jul 7–13
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2018, Jul 7–13
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2019, Jul 7–13
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2020, Jul 7–13
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2021, Jul 7–13
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2022, Jul 7–13
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2023, Jul 7–13
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2024, Jul 7–13
- open-meteo:weather_archive — lat 50.02, lon 19.95, 2025, Jul 7–13
- user-input — original request

## Open questions

None
