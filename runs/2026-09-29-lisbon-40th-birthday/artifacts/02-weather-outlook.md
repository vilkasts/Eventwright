# Weather outlook: Lisbon, 2027-06-12

## Meta

- Run: 2026-09-29-lisbon-40th-birthday
- Agent: weather-analyst
- Mode: initial
- Inputs: input.md, clarifications.md, artifacts/01-requirements.md

## Summary

Lisbon in mid-June is warm and very dry: across 70 sampled days (June 9-15, 2016-2025) only 4 had 1.0 mm of rain or more, giving a 6% rain risk. Mean daytime maximum is 24.6 °C, and sunset is around 21:01 local time, so the 20:00 start is in daylight and the evening turns to dusk during dinner. Outdoor use is suitable.

## Location

- City: Lisbon, Portugal
- Latitude: 38.70 (grid cell echoed by the server; geocoder gave 38.725)
- Longitude: -9.20 (grid cell echoed by the server; geocoder gave -9.150)
- Timezone: Europe/Lisbon (UTC+1 in June)

## Method

- Method: climatology-10y
- Why: the event is on 2027-06-12 and today is 2026-09-29, which is 256 days away, well beyond the 14-day forecast limit.
- Periods queried: weather_archive for June 9-15 (event date 2027-06-12 plus or minus 3 days) in each year 2016 through 2025, 70 days in total.
- Daily variables: temperature_2m_max, temperature_2m_min, precipitation_sum, sunset (timezone Europe/Lisbon).
- Rain risk is the share of days with precipitation_sum of at least 1.0 mm: 4 of 70 days, 6%.

## Outlook

| Metric | Value |
| --- | --- |
| Mean max °C | 24.6 |
| Mean min °C | 16.0 |
| Rain risk % | 6 |
| Typical sunset (local time) | 21:01 |

### Per year (June 9-15)

| Year | Rainy days (of 7) | Mean max °C |
| --- | --- | --- |
| 2016 | 0 | 21.6 |
| 2017 | 0 | 28.6 |
| 2018 | 2 | 21.8 |
| 2019 | 0 | 21.3 |
| 2020 | 1 | 21.2 |
| 2021 | 0 | 27.5 |
| 2022 | 0 | 29.6 |
| 2023 | 1 | 24.9 |
| 2024 | 0 | 23.8 |
| 2025 | 0 | 25.2 |

## Outdoor suitability

- Rain risk: 6%
- Verdict: outdoor-ok

Rain risk is below 20% and the mean maximum of 24.6 °C sits inside the 15-32 °C comfort band, so a rooftop or garden venue is well supported for 30 guests. The requirements accept either an indoor room at the same venue or an outdoor-only venue as plan B, so a full covered fallback is not required, though a light contingency such as a canopy or a nearby indoor corner is prudent. Evenings cool to about 16 °C after sunset near 21:00, so a rooftop dinner starting at 20:00 may want light wraps or heaters late in the evening. Individual years reached 33 °C at the hottest, so shade during arrival is worth having.

## Sources

- open-meteo:geocoding — Lisbon, PT (top result lat 38.725, lon -9.150, Europe/Lisbon)
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2016, Jun 9-15
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2017, Jun 9-15
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2018, Jun 9-15
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2019, Jun 9-15
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2020, Jun 9-15
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2021, Jun 9-15
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2022, Jun 9-15
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2023, Jun 9-15
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2024, Jun 9-15
- open-meteo:weather_archive — lat 38.70, lon -9.20, 2025, Jun 9-15
- user-input — original request

## Open questions

None
