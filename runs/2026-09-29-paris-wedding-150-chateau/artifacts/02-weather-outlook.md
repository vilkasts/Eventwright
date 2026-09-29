# Weather Outlook

## Meta
- Run: 2026-09-29-paris-wedding-150-chateau
- Agent: weather-analyst
- Mode: initial
- Inputs: input.md, clarifications.md, artifacts/01-requirements.md

## Summary
The wedding on 2027-09-18 is 354 days away, so a 10-year climatology of the same calendar window near Paris was used. Mid-September days are mild (mean max 22.1 °C) with a 23% chance of a rainy day (at least 1.0 mm). The verdict is outdoor-with-plan-b: the garden ceremony is realistic, but a covered or indoor fallback is needed.

## Location
- City: Paris, France
- Latitude: 48.85 (geocoding); the weather grid cell answered for 48.82, 2.29
- Longitude: 2.35 (geocoding)
- Timezone: Europe/Paris (CEST, UTC+2 on the event date)

## Method
- Method: climatology-10y
- Why: the event date 2027-09-18 is 354 days after today (2026-09-29), which is more than 14 days, so no forecast is available.
- Periods queried: the window Sep 15–21 (event date ± 3 days) in each full year 2016–2025, 70 days in total.
- Daily variables: temperature_2m_max, temperature_2m_min, precipitation_sum, sunset (timezone Europe/Paris).
- A rainy day is a day with precipitation_sum of at least 1.0 mm: 16 of 70 days, 23%.

## Outlook
| Metric | Value |
| --- | --- |
| Mean max temperature | 22.1 °C |
| Mean min temperature | 12.5 °C |
| Rain risk | 23% |
| Typical sunset (local time) | 19:57 |

### Per year (Sep 15–21)
| Year | Rainy days (of 7) | Mean max °C |
| --- | --- | --- |
| 2016 | 2 | 20.9 |
| 2017 | 5 | 16.8 |
| 2018 | 1 | 24.7 |
| 2019 | 0 | 23.7 |
| 2020 | 0 | 28.4 |
| 2021 | 2 | 20.9 |
| 2022 | 0 | 18.4 |
| 2023 | 3 | 23.3 |
| 2024 | 1 | 21.4 |
| 2025 | 2 | 22.2 |

## Outdoor suitability
- Rain risk: 23%
- Verdict: outdoor-with-plan-b

Temperatures suit an outdoor ceremony, but roughly one day in four brings rain, and evenings cool to about 12 °C with sunset near 19:57. The venue needs a covered or indoor fallback area able to hold all 150 guests for the ceremony, close to the garden and step-free for seniors and reduced-mobility guests. Since the event runs until 01:00, the reception should be planned indoors, with the garden used for the ceremony and early evening, and warm layers or heaters considered for guests outside.

## Sources
- open-meteo:geocoding — Paris, France (lat 48.85, lon 2.35, Europe/Paris)
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2016, Sep 15–21
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2017, Sep 15–21
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2018, Sep 15–21
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2019, Sep 15–21
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2020, Sep 15–21
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2021, Sep 15–21
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2022, Sep 15–21
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2023, Sep 15–21
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2024, Sep 15–21
- open-meteo:weather_archive — lat 48.82, lon 2.29, 2025, Sep 15–21
- user-input — original request
- user-input — clarification round 2

## Open questions
None
