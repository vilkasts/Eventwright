---
name: artifact-validator
description: Reusable structure + citation rules and self-check for Eventwright workflow artifacts (runs/<runId>/artifacts/*.md). Use right after writing or rewriting any workflow artifact, before replying DONE to the coordinator.
---

# artifact-validator

Every workflow artifact has the same predictable shape so humans and agents can read it and the coordinator can check it deterministically.

## Required structure (strict section order)

```
# <Title>
## Meta
- Run: <runId>
- Agent: <agent name>
- Mode: initial | retry | revise
- Inputs: <files>
## Summary
## <your sections — exactly src/config/dag.ts → DAG.agents["<name>"].sections, same order>
## Sources
## Open questions
```

Skeleton: `template.md` in this skill's folder. No other `##` headings (use `###` inside sections).
Required lines: `src/config/dag.ts → DAG.agents["<name>"].requiredLines` must each appear at the start of a line, e.g. `- Budget: 9000 EUR`.

## Money format (deterministic budget check)

`- <Label>: <amount> <CUR>` — amount is digits with an optional `.` decimal part, **no thousands separators**, CUR is the ISO code from the requirements. Example: `- Catering cost: 2400 EUR`. For the labels in `DAG.agents["<name>"].moneyLines` (`- Budget:` in 01, `- Total with contingency:` in 07) `wf check` enforces this format (only `unknown` is allowed besides it, in a requirements draft), because G7 parses them.

## Citation rules

- Every venue, vendor, price or factual claim from the web → a `## Sources` bullet: `- https://… — what was taken (accessed YYYY-MM-DD)`. Only URLs you actually opened (WebFetch) or got from WebSearch. Never invent URLs.
- Weather figures → `- open-meteo:<tool> — lat, lon, period`.
- Holidays → `- holidays:get_holidays — <country code>, <year>`.
- Facts from the user → `- user-input — original request` / `- user-input — clarification round N`.
- `## Open questions`: `None` or a list. Do not leave questions you could have resolved from your inputs.
- Forbidden: TODO, TBD, FIXME, `???`, unfilled `<…>` template tokens, and the `|` character inside table cells.

## Self-check (run AFTER writing the file)

1. `npm run -s wf -- lint <runId> <agent>`
2. On exit code 1: fix every listed issue with **one** full rewrite (Write), then repeat step 1. At most 2 fixes.
3. If issues remain after 2 fixes: reply `FAILED <short reason>`; the coordinator decides on a retry.

`lint` never changes workflow state; only the coordinator's `check` does.
