# Weather Outlook

## Meta

- Run: 2026-09-29-new-year-team-party
- Agent: weather-analyst
- Mode: retry
- Inputs: input.md, clarifications.md, artifacts/01-requirements.md

## Summary

Warsaw on New Year's Eve is cold and damp: over the last 10 years the Dec 28 to Jan 3 window averaged 4.7 C highs and 0.3 C lows, with measurable rain or snow on 43% of days. An outdoor party is possible only with a heated, covered fallback area.

## Location

- City: Warsaw, Poland
- Latitude: 52.23 (grid cell answered at 52.267)
- Longitude: 21.01 (grid cell answered at 20.961)
- Timezone: Europe/Warsaw

## Method

- Method: climatology-10y

The event date 2026-12-31 is 93 days after today (2026-09-29), more than 14 days, so no forecast is available and climatology is used. Queried weather_archive for each of the last 10 full years 2016 to 2025, window Dec 28 to Jan 3 (event date plus or minus 3 days, 7 days per year, 70 days total), daily temperature_2m_max, temperature_2m_min, precipitation_sum and sunset, timezone Europe/Warsaw. A rainy day is a day with precipitation_sum of at least 1.0 mm (30 of 70 days). In winter this precipitation may fall as snow.

## Outlook

| Metric | Value |
| --- | --- |
| Mean max temperature | 4.7 C |
| Mean min temperature | 0.3 C |
| Rain risk | 43% |
| Typical sunset | 16:32 local time |

### Per-year detail

| Year | Rainy days (of 7) | Mean max C |
| --- | --- | --- |
| 2016 | 2 | 2.1 |
| 2017 | 3 | 5.8 |
| 2018 | 6 | 4.2 |
| 2019 | 1 | 3.3 |
| 2020 | 3 | 3.7 |
| 2021 | 4 | 5.6 |
| 2022 | 0 | 10.8 |
| 2023 | 4 | 6.7 |
| 2024 | 2 | 4.3 |
| 2025 | 5 | 0.7 |

## Outdoor suitability

- Rain risk: 43%
- Verdict: outdoor-with-plan-b

Rain risk falls in the 20 to 45% band and the mean high of 4.7 C is far below the 15 C comfort band, so a fully open-air party is not advisable. The venue needs a covered, wind-protected and heated terrace or a heated marquee with a sheltered area for all 41 guests, plus an indoor fallback; a photo booth should also sit in the sheltered area. Sunset is about 16:32, so the whole evening is in darkness and needs lighting and outdoor heaters.

## Sources

- open-meteo:geocoding — Warsaw, Poland (lat 52.23, lon 21.01, Europe/Warsaw)
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2016-12-28 to 2017-01-03
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2017-12-28 to 2018-01-03
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2018-12-28 to 2019-01-03
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2019-12-28 to 2020-01-03
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2020-12-28 to 2021-01-03
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2021-12-28 to 2022-01-03
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2022-12-28 to 2023-01-03
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2023-12-28 to 2024-01-03
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2024-12-28 to 2025-01-03
- open-meteo:weather_archive — lat 52.267, lon 20.961, 2025-12-28 to 2026-01-03
- user-input — clarification round 1

## Open questions

None
