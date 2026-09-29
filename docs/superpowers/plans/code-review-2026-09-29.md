# Code review findings — 2026-09-29

Full review of `src/` (types, config, lib, io, cli, hooks), `.claude/settings.json` and the orchestration prompts that call the CLI.
Baseline at review time: commit `1fd74f0`, `npm test` 145/145 pass, `npm run typecheck` and `npm run lint` clean.

## How to use this file (for an implementing agent)

- Every finding has a stable id (`F01`…`F18`). Implement only the ids the user selected.
- `Status: confirmed` means the scenario was reproduced with a script; `Status: by reading` means it follows from the code but was not executed.
- For every fixed finding add a regression test in the matching `tests/` folder (`node:test`, see `CLAUDE.md` → Tooling). The test should fail before the fix and pass after it.
- Follow `CLAUDE.md`: layer import direction, no classes, no `as`, named constants, English only, `npm run format` before commit.
- Changing `src/config/dag.ts` (e.g. F07 option B) also requires updating agents, `.claude/agents/validator.md` and tests (invariant 10).

## Summary

| Id  | Severity    | Area                         | Title                                                              | Status     |
| --- | ----------- | ---------------------------- | ------------------------------------------------------------------ | ---------- |
| F01 | high        | io / hooks                   | Lost updates: concurrent writes of `workflow-state.json`           | confirmed  |
| F02 | high        | cli / lib gates              | `record-gates` accepts a stale validator report                    | confirmed  |
| F03 | high (Win/macOS) | lib guards              | State/approval file guard is case-sensitive                        | confirmed  |
| F04 | medium      | io / hooks                   | PreToolUse guards fail open on exceptions                          | by reading |
| F05 | medium      | lib state                    | `html-builder` keeps output hashes from previous rounds            | confirmed  |
| F06 | medium      | lib schemas                  | Shallow state schema validation (NaN counters, crashes)            | confirmed  |
| F07 | medium      | lib budget / dag             | Malformed `- Budget:` in requirements blames the wrong G7 owners   | confirmed  |
| F08 | low–medium  | lib guards                   | Shell guard bypass via chained commands / globs                    | confirmed  |
| F09 | low         | lib guards                   | Output shell-write detection needs a trailing separator            | by reading |
| F10 | low         | cli / io                     | `runId` not validated; state `runId` vs folder mismatch            | by reading |
| F11 | low         | cli                          | `wf start` accepts skipped or blocked agents                       | by reading |
| F12 | low         | cli                          | `wf list` fails entirely on one broken run                         | by reading |
| F13 | low         | lib / commands               | Malformed `/approve-event` is silently ignored                     | by reading |
| F14 | low         | lib artifact-check           | `R-\d{2}` misses requirement ids `R-100`+                           | by reading |
| F15 | low         | lib gates                    | Duplicate gate rows: last wins (incl. rows quoted in Details)      | by reading |
| F16 | low         | io clock                     | `runId` date uses UTC                                              | by reading |
| F17 | performance | hooks config                 | 4 node+tsx processes per Write, 2 per Bash                         | measured   |
| F18 | performance | cli / lib state              | `wf next` rewrites state every call; unbounded log                 | by reading |

---

## F01 — Lost updates: concurrent writes of `workflow-state.json`

- Severity: high
- Status: confirmed (5 of 20 stress runs lost an update; 2 × `ENOENT` on rename)
- Files: `src/io/files.ts:24-28` (`writeJsonAtomic`), `src/io/state-store.ts`, `src/hooks/post-write-state.ts`
- Problem: every hook/CLI call does load → mutate → save with no lock. The temp file name `workflow-state.json.tmp` is shared by all processes.
- Scenario: agents of one parallel group (catering ∥ entertainment ∥ logistics) finish their Writes at the same time; three `post-write-state` processes run concurrently. One process saves a state loaded before another's save → that agent stays `running` → `wf check` reports "not rewritten since started" → needless retry, may escalate to `failure`. Concurrent `renameSync` of the shared `.tmp` throws `ENOENT` and the write is not recorded at all.
- Repro: create a run, write three artifacts, pipe three Write payloads into `src/hooks/post-write-state.ts` in parallel (`&` + `wait`), count agents with status `done`.
- Fix:
  1. Unique temp file per process (e.g. `${filePath}.${process.pid}.${random}.tmp`); update `state-integrity` protected-name matching accordingly (match `workflow-state.json*` / `approval.json*`).
  2. Exclusive lock around the whole load–mutate–save in `src/io` (e.g. `mkdirSync(lockDir)` with retry/backoff and stale-lock timeout, released in `finally`). Provide a helper like `updateState(runId, mutate)` and use it from the CLI commands, `post-write-state` and `recordDecision`.
- Acceptance: parallel stress test (≥3 concurrent hook processes, repeated) never loses an update and never throws.

## F02 — `record-gates` accepts a stale validator report

- Severity: high (quality-gate bypass)
- Status: confirmed
- Files: `src/cli/commands/flow-commands.ts:55-63`, `src/lib/gates.ts:60-101` (esp. line 92)
- Problem: `record-gates` reads whatever `validation-<stage>.md` is on disk. It does not check that the report was written after the gates were reset (`state.validation[stage]` non-null, `recorded === false`, file sha256 equals `state.validation[stage].sha256`).
- Scenario: final gates all PASS → human rejects → plan rewritten, final gates reset to `pending`, `validation.final = null` → validator fails or writes via Bash (not recorded) → coordinator runs `record-gates` → the old all-PASS report is recorded → `next` returns `await-approval` for an unvalidated plan. Same for domain stage.
- Fix: in `record-gates` (or `recordGates`) require `state.validation[stage] !== null && !state.validation[stage].recorded` and `sha256OfFile(report) === state.validation[stage].sha256`; otherwise throw an actionable error ("the validator report was not rewritten — relaunch the validator").
- Acceptance: test where the gates are reset and the old report is still on disk → `record-gates` throws and gates stay `pending`.

## F03 — State/approval file guard is case-sensitive

- Severity: high on Windows/macOS (case-insensitive file systems)
- Status: confirmed (`stateIntegrityViolation` returns `null` for `C:\p\runs\r\Approval.JSON`)
- Files: `src/lib/guards/state-integrity.ts:8-17` (`baseName`, `PROTECTED_FILES.includes`), same for the Bash check at lines 20-27
- Problem: basename compared case-sensitively. `Write` to `runs/<id>/Approval.JSON` passes the guard; on a case-insensitive FS it overwrites `approval.json`. Under `npm run claude:run` (`acceptEdits`) Write needs no confirmation.
- Impact: the model can forge approval (sha256 of the plan is computable) → `approval-gate-guard` allows writing the final document without a human.
- Fix: compare lower-cased names (file tools and shell commands). Optionally also deny file-tool writes to the run root `runs/<id>/<file>` except `input.md` and `clarifications.md`.
- Acceptance: unit tests for mixed-case `approval.json` / `workflow-state.json` (and `.tmp` variants) via Write, Edit, MultiEdit and Bash.

## F04 — PreToolUse guards fail open on exceptions

- Severity: medium
- Status: by reading
- Files: `src/io/hook-io.ts:7-11`, `src/hooks/approval-gate-guard.ts`, `src/hooks/state-integrity-guard.ts`, `src/hooks/no-leak-guard.ts`
- Problem: an uncaught exception (invalid JSON on stdin, `readApproval` throwing on an invalid `approval.json`, fs error) exits with code 1. Claude Code treats exit codes other than 0/2 as non-blocking errors and runs the tool.
- Scenario: `approval.json` invalid → `isApproved` throws → `approval-gate-guard` crashes → output write allowed.
- Fix: wrap each guard body in try/catch; on error call `denyToolUse` with a message naming the error (fail closed). `post-write-state` and `record-approval` should report errors visibly (stderr + exit 2 for record-approval) instead of crashing silently.
- Acceptance: hook process tests with a corrupt `approval.json` / state file → decision `deny`.

## F05 — `html-builder` keeps output hashes from previous rounds

- Severity: medium
- Status: confirmed
- Files: `src/lib/state.ts:88-97` (`recordOutputWrite`), `markStale` / `recordAgentStarts`
- Problem: `html-builder` becomes `done` when every output file has a hash in `agent.outputs`; hashes are never cleared, so hashes from the previous round count.
- Scenario: second render round → only `event-plan.md` written → agent immediately `done` while `event-plan.html` is stale.
- Fix: clear `outputs` when `html-builder` is started (`recordAgentStarts`) or marked stale/invalidated; alternatively record the start time and only count outputs written after it.
- Acceptance: test: done → stale → write only `.md` → status is not `done`.

## F06 — Shallow state schema validation

- Severity: medium
- Status: confirmed (missing `startsWithoutArtifact` → `NaN` → immediate `failure` of kind `agent`)
- Files: `src/lib/schemas/workflow-state.ts:9-16`
- Problem: only `status`, `attempts`, `structureOk` are checked per agent; `startsWithoutArtifact`, `structuralFailures`, `sha256`, `updatedAt`, `lastError`, `feedback`, `outputs`, gate `findings`, `plan`, `failure`, `validation` entries, `phase` are not.
- Scenario: an older state file or a hand-edited one passes validation; `+= 1` on an undefined counter yields `NaN`, and `NaN <= MAX_RETRIES + 1` is false → run fails at once. Missing `outputs` → TypeError in `recordOutputWrite`.
- Fix: validate every field with its type (numbers finite, nullable strings, `outputs` record of strings, `plan`/`failure`/`validation` shapes). Bump `SCHEMA_VERSION` if the persisted shape changes as part of other fixes.
- Acceptance: tests rejecting a state with each required field missing or mistyped.

## F07 — Malformed `- Budget:` in requirements blames the wrong G7 owners

- Severity: medium
- Status: confirmed (`budgetStatus("- Budget: 9,000 EUR", …)` → `limit: null`, `withinLimit: false`)
- Files: `src/lib/budget.ts:8-13`, `src/config/dag.ts` (G7/G8 owners), `src/lib/artifact-check.ts`
- Problem: `parseMoney` requires `- Budget: 9000 EUR`. If the formalizer writes `9,000 EUR`, `€9000` etc., G7 fails, but `requirements-formalizer` is not a G7 owner → planners and `budget-aggregator` are retried 3 times and the run blocks, though none of them can fix it.
- Fix (option A, preferred): make the structural check of `01-requirements.md` validate that `- Budget:` parses with `parseMoney` (and the same for `07-budget.md` money lines), so the formalizer is retried at `check`. Option B: add `requirements-formalizer` to G7/G8 owners (requires invariant-10 updates).
- Acceptance: `wf check <run> requirements-formalizer` fails with a clear message for `- Budget: 9,000 EUR`.

## F08 — Shell guard bypass via chained commands / globs

- Severity: low–medium (mitigated: only `npm run -s wf -- *` is allow-listed, other Bash asks the human)
- Status: confirmed for chaining
- Files: `src/lib/guards/state-integrity.ts:20-27`, `src/config/hooks.ts:9`
- Problem: substring matching. `npm run -s wf -- status r; echo {} > runs/r/workflow-state.json` passes (prefix matches); globs like `approval.js?n` and string concatenation are not detected.
- Fix: for commands mentioning state files, require the whole command to be a single `wf` call (reject `;`, `&&`, `||`, `|`, `>`, backticks, `$(`); match protected names case-insensitively and also their glob-ish stems (`workflow-state`, `approval.`).
- Acceptance: unit tests for chained, piped and redirected variants.

## F09 — Output shell-write detection needs a trailing separator

- Severity: low
- Status: by reading
- Files: `src/lib/guards/output-target.ts:6`
- Problem: `SHELL_OUTPUT_PATH` requires `runs/<id>/output/` with a separator after `output`; `cp x runs/r/output` and `cd runs/r/output && …` are not detected.
- Fix: accept `output` followed by separator, whitespace, quote or end of string; also treat `cd … runs/<id>/output` + write command as a match.
- Acceptance: unit tests for both forms.

## F10 — `runId` not validated; state `runId` vs folder mismatch

- Severity: low
- Status: by reading
- Files: `src/cli/require-run.ts`, `src/io/paths.ts`, `src/io/state-store.ts:12-18`, `src/hooks/record-approval.ts`
- Problem: any string (incl. `../`) is joined into paths. `saveState` writes to `statePath(state.runId)` (from the file), so a copied run folder whose state still has the old `runId` writes into the original run.
- Fix: validate `runId` with the same pattern as `init` (`YYYY-MM-DD-<slug>`) in `requireRun`, `record-approval` and `parseRunPath`; in `loadState` throw if `state.runId !== runId`.
- Acceptance: tests for `../x` and for a mismatched `runId`.

## F11 — `wf start` accepts skipped or blocked agents

- Severity: low
- Status: by reading
- Files: `src/cli/commands/agent-commands.ts:39-45`, `src/lib/agent-runs.ts:20-36`
- Problem: no check that the agent is runnable; a `skipped` agent becomes `running` and blocks its dependents (`isDone` false).
- Fix: reject `skipped` agents and agents whose deps are not done/skipped, with an actionable message.
- Acceptance: CLI test: `start` on a skipped agent exits 1, state unchanged.

## F12 — `wf list` fails entirely on one broken run

- Severity: low
- Status: by reading
- Files: `src/cli/commands/run-commands.ts:24-31`
- Problem: one invalid state throws and aborts the list; `/resume-event` without arguments then fails.
- Fix: catch per run and output `{ runId, error }` for invalid ones.
- Acceptance: CLI test with one corrupt run next to a valid one.

## F13 — Malformed `/approve-event` is silently ignored

- Severity: low
- Status: by reading
- Files: `src/lib/approval-command.ts:3-15`, `src/hooks/record-approval.ts`, `.claude/commands/approve-event.md`
- Problem: `/approve-event <id> extra` matches neither regex → nothing recorded, but the slash command text tells the coordinator the hook "has already validated and recorded the decision".
- Fix: if the prompt starts with `/approve-event` or `/reject-event` but does not parse, block the prompt with the expected usage.
- Acceptance: hook test: `/approve-event r extra` → exit 2 with usage message.

## F14 — `R-\d{2}` misses requirement ids `R-100`+

- Severity: low
- Status: by reading
- Files: `src/lib/artifact-check.ts:9`
- Fix: `/\bR-\d{2,}\b/g`.
- Acceptance: unit test with `R-100`.

## F15 — Duplicate gate rows: last wins

- Severity: low
- Status: by reading
- Files: `src/lib/gates.ts:18-31`
- Problem: every line of the report that looks like a gate row is parsed; a row quoted later (e.g. in `## Details`) overrides the real result.
- Fix: parse only the `## Gate results` section; throw on duplicate gate ids.
- Acceptance: unit test with a quoted PASS row after a FAIL row.

## F16 — `runId` date uses UTC

- Severity: low
- Status: by reading
- Files: `src/io/clock.ts:5`
- Problem: `todayIso` slices `toISOString()` (UTC); near local midnight the run date differs from the local `Today` passed to agents.
- Fix: build the date from local `getFullYear/getMonth/getDate`.

## F17 — Hook process overhead

- Severity: performance
- Status: measured (≈250–330 ms per hook process)
- Files: `.claude/settings.json`, `src/hooks/*`
- Problem: every Write/Edit starts 4 node processes (3 PreToolUse + 1 PostToolUse), every Bash 2; each compiles TypeScript through tsx on start. It also widens the F01 race window.
- Fix: one dispatcher per event (`pre-tool-use.ts` running all three guards in-process; `post-tool-use.ts`), keeping the lib guards unchanged; optionally precompile.
- Acceptance: settings test updated; hooks tests pass.

## F18 — `wf next` rewrites state every call; unbounded log

- Severity: performance
- Status: by reading
- Files: `src/cli/commands/run-commands.ts:37-44`, `src/lib/state.ts:44-46`
- Problem: `next` saves even when nothing changed; `log` grows forever, so every save rewrites a growing file and competes with hooks (F01).
- Fix: save only when `phase` changes or `--resume` logs; cap the log (or move it to an append-only `log.jsonl`).
