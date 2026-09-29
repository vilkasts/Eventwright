---
name: event-html-theme
description: Rendering rules and the fixed HTML template for the user-facing Eventwright event plan (event-plan.md + event-plan.html). Use when producing the final output of the workflow.
---

# event-html-theme

The final document has the **same structure for every run**.

## Sections (strict order, identical in MD and HTML)

| #   | HTML id       | Heading               | From the plan section                          |
| --- | ------------- | --------------------- | ---------------------------------------------- |
| 1   | `overview`    | Overview              | Event overview                                 |
| 2   | `weather`     | Weather & Plan B      | Weather and plan B                             |
| 3   | `venue`       | Venue                 | Venue                                          |
| 4   | `menu`        | Menu                  | Menu                                           |
| 5   | `program`     | Program               | Program                                        |
| 6   | `run-of-show` | Run of Show           | Run of show (table: Time · What · Who)         |
| 7   | `checklist`   | Preparation Checklist | Preparation checklist (grouped by deadline)    |
| 8   | `budget`      | Budget                | Budget (table: Item · Cost; totals row; limit) |
| 9   | `sources`     | Sources               | external URLs only                             |

The "Requirements matrix" is an internal check and is **not** rendered.

## Rules

1. Write `event-plan.md` first: first line `# <Event name> — Event Plan`, then the 9 `##` headings exactly as in the table.
2. Then write `event-plan.html`: a copy of `template.html` from this folder with **only** these placeholders replaced: `{{TITLE}}` (twice), `{{SUBTITLE}}`, `{{GENERATED_AT}}`, `{{OVERVIEW}}`, `{{WEATHER}}`, `{{VENUE}}`, `{{MENU}}`, `{{PROGRAM}}`, `{{RUN_OF_SHOW}}`, `{{CHECKLIST}}`, `{{BUDGET}}`, `{{SOURCES}}`. Do not change CSS, layout or section order.
3. Section content is plain HTML: `<p>`, `<ul>/<ol>/<li>`, `<table>` with `<thead>`, `<strong>`, `<a href="…" target="_blank" rel="noopener">`. No scripts, no external assets. Escape `&`, `<`, `>` in text.
4. Never mention workflow internals: artifact file names, `runs/`, state files, agent names, `mcp__…`, `open-meteo:<tool>`, `holidays:<tool>`. Weather sources are written as "Open-Meteo historical weather (2016–2025)" or "Open-Meteo forecast"; holiday data as "Public holidays: Nager.Date (date.nager.at)". The `no-leak-guard` hook blocks violations — on a block, rephrase and write again.
