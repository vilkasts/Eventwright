# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Eventwright is an agentic event-planning workflow for Claude Code: a `/plan-event` coordinator, single-responsibility subagents, quality gates with targeted retries, deterministic human approval and resumable state.

## Language

**Everything in this repository is written in English**: code comments, documentation (`README.md`, `CLAUDE.md`, `runs/*/SCENARIO.md`), agent prompts, skills, slash commands, templates, workflow artifacts, the final event plan, CLI and hook messages, and commit messages.

- A user's request may arrive in any language; agents still write artifacts in English and keep proper names as given.
- Chat replies to the user may follow the user's language — that is conversation, not project content.

## Commands

```bash
npm install                      # once, after clone
npm run claude                   # start Claude Code with the project MCP servers (.claude/mcp.json)
npm run claude:run               # lean session for workflow runs: project settings and MCP only, Sonnet, acceptEdits
npm test                         # all node:test suites
node --import tsx --test tests/lib/next-action.test.ts   # a single test file
npm run typecheck                # tsc --noEmit
npm run lint                     # ESLint (layer rules, no classes/enum/as/default export)
npm run format                   # Prettier (run before every commit)
npm run -s wf -- list            # all runs with phase and failure
npm run -s wf -- status <runId>  # agents, gates and execution plan of a run
npm run -s wf -- next <runId>    # the next action as JSON (what the coordinator does next)
```

## Workflow architecture

Hub-and-spoke: the coordinator is the main Claude Code session running a slash command; it follows skill `workflow-orchestration`, asks the CLI what to do next and launches subagents. It never writes event content.

| Component      | Where                                                                      | Role                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slash commands | `.claude/commands/{plan-event,resume-event,approve-event,reject-event}.md` | Coordinator entry points; approve/reject are human-only (`disable-model-invocation`)                                                                                        |
| 10 subagents   | `.claude/agents/*.md`                                                      | One responsibility and one artifact each (see `src/config/dag.ts`)                                                                                                          |
| 6 skills       | `.claude/skills/*/SKILL.md`                                                | `workflow-orchestration`, `artifact-validator`, `web-research`, `weather-lookup`, `holiday-lookup`, `event-html-theme`                                                      |
| 5 hooks        | `src/hooks/*.ts`, registered in `.claude/settings.json`                    | PreToolUse: `state-integrity-guard` (also artifact ownership), `approval-gate-guard`, `no-leak-guard`; PostToolUse: `post-write-state`; UserPromptSubmit: `record-approval` |
| MCP (2)        | `.claude/mcp.json` → `open-meteo-mcp-server`, `@pipeworx/mcp-holidays`     | Weather (geocoding, forecast, archive) for `weather-analyst` and `validator`; public holidays (Nager.Date) for `venue-scout` and `validator` (G4)                           |
| Workflow CLI   | `src/cli/main.ts` (`npm run -s wf -- …`)                                   | The only way the coordinator changes state; `next` computes the next step                                                                                                   |
| Workflow graph | `src/config/dag.ts`                                                        | Agents, dependencies, artifacts, sections, required and money lines, gates and owners                                                                                       |
| Runs           | `runs/<runId>/`                                                            | `input.md`, `clarifications.md`, `artifacts/`, `workflow-state.json`, `approval.json`, `output/`                                                                            |

Execution order (groups run one after another; agents inside a group run in parallel):

```
[requirements-formalizer] → clarify (human confirms requirements) → execution plan (wf plan: - Services:)
→ [weather-analyst] → [venue-scout] → [catering-planner ∥ entertainment-planner ∥ logistics-planner — only selected]
→ [budget-aggregator] → validate domain (G1–G9) → [event-plan-builder] → validate final (G10–G12)
→ human approval (/approve-event | /reject-event) → [html-builder] → output/event-plan.{md,html}
```

| Gate                               | Stage  | Owners                                                                  |
| ---------------------------------- | ------ | ----------------------------------------------------------------------- |
| G1-requirements-complete           | domain | requirements-formalizer                                                 |
| G2-sources-cited                   | domain | venue-scout, catering-planner, entertainment-planner, logistics-planner |
| G3-weather-grounded                | domain | weather-analyst                                                         |
| G4-venue-fit                       | domain | venue-scout                                                             |
| G5-dietary-coverage                | domain | catering-planner                                                        |
| G6-weather-plan-b                  | domain | venue-scout, entertainment-planner, logistics-planner                   |
| G7-budget-within-limit             | domain | the four planners + budget-aggregator                                   |
| G8-currency-consistent             | domain | the four planners + budget-aggregator                                   |
| G9-must-haves-covered              | domain | the four planners                                                       |
| G10-plan-covers-requirements       | final  | event-plan-builder                                                      |
| G11-plan-consistent-with-artifacts | final  | event-plan-builder                                                      |
| G12-timeline-feasible              | final  | event-plan-builder                                                      |

A gate whose owners are all skipped by the execution plan is `n/a`: the validator does not check it and `record-gates` does not require its row (e.g. G5 without catering). Skipped agents are removed from the owners of other gates.

## Execution rules (invariants)

1. The coordinator never writes content; only `wf next` decides the next step.
2. Agents of one group are launched in a single message.
3. `check` after every group; the next group starts only after its inputs pass.
4. `workflow-state.json` and `approval.json` change only via the CLI and hooks.
5. Approval = a human-typed `/approve-event <runId>` bound to the plan's sha256; any plan change revokes it.
6. Retry limit 3 consecutive failures per gate / structural check / agent start without an artifact; beyond it the run stops with a report.
7. Which service planners run is decided by the confirmed `- Services:` line and applied by `wf plan`; skipped agents are never started or invalidated.
8. After a rejection, the coordinator invalidates upstream owners per the ownership table; downstream regenerates automatically.
9. Never format or hand-edit `runs/**` (hashes).
10. Changing `src/config/dag.ts` (agents, sections, requiredLines, moneyLines, gates) requires updating agents, `validator.md` and tests.
11. The coordinator runs on Sonnet: the four slash commands and skill `workflow-orchestration` set `model: sonnet` (the override lasts for the current turn, whatever the session model is); subagents set their own `model`. Keep it that way — the coordinator is the longest-lived context and dominates token usage.
12. Each artifact is written only by its owning agent with the Write tool (`validation-*.md`: `validator`; `output/*`: `html-builder`); `state-integrity-guard` denies any other writer, including the coordinator. `record-gates` accepts only a report the validator wrote after the gates were reset.

## Code style

### Language and typing

- **TypeScript only**: every source file under `src/` and `tests/` is `.ts`. Plain `.js`/`.mjs` is allowed only for tool configs that require it (e.g. `eslint.config.js`).
- **Strict typing everywhere.** `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. Type checking (`tsc --noEmit`) is part of the pre-commit hook.
- `type` over `interface`; union types over `enum` (`type AgentStatus = "pending" | "running" | "done" | "stale" | "skipped"`); no `namespace`.
- **No `any`.** Data from outside (JSON files, hook stdin, CLI arguments) enters as `unknown` and is narrowed by a parse function or type guard before use (`src/lib/narrow.ts`, `src/lib/schemas/`). `as` casts are forbidden except `as const`.
- Exported functions have explicit parameter and return types. Type-only imports use `import type`.
- Shared domain types (`WorkflowState`, `AgentState`, `Action`, `Brief`, `GateSummary`, …) live in `src/types/` and are reused, never redeclared.
- Prefer `readonly` for shared types and arrays that must not be mutated.

### Functions, not classes

- **No classes.** Arrow functions everywhere:

  ```ts
  type BudgetStatus = { withinLimit: boolean; issues: string[] };

  export const budgetStatus = (requirementsText: string, budgetText: string): BudgetStatus => {
    /* … */
  };
  ```

- **SOLID and clean code:** small single-responsibility functions; choose the lightest option that works; compact yet readable for a junior developer.
- A file past ~150 lines, or a function past ~40 lines, is a signal to split it.

### Naming

- Files and folders: kebab-case (`artifact-check.ts`, `approval-gate-guard.ts`).
- Functions and variables: camelCase. Types: PascalCase. Module-level constants: UPPER_SNAKE_CASE (`MAX_RETRIES`, `PLAN_AGENT`).
- Boolean names start with `is` / `has` / `can` / `should` (`isApproved`, `hasOpenQuestions`).

### No magic values

- Every literal with a meaning goes into a named constant.
- Shared constants go to `src/config/`. Workflow facts (agents, artifacts, dependencies, gates, retry limit) come **only** from `src/config/dag.ts` — a constant typed as `Dag`, so a missing or misspelled agent or gate is a compile error. Agent and gate names are literal tuples in `src/types/workflow.ts` (`AGENT_NAMES`, `GATE_IDS`); their union types are derived from them.
- Local constants sit next to their usage.

### Module structure and import direction

```
src/
  types/    shared domain types and the literal tuples they derive from — imports nothing
  config/   the workflow DAG and constants — imports types
  lib/      pure domain logic (state, execution plan, gates, next action, approval rules, checks, hook policies) — no fs, no process
  io/       file system, state persistence, hook stdin/stdout — the only layer that touches fs
  cli/      coordinator CLI entry and commands (npm run -s wf -- <command>)
  hooks/    Claude Code hook entry points (.claude/settings.json runs them)
tests/
  support/  shared fixtures (not run by the test runner)
  lib/ io/ cli/ hooks/ config/   node:test suites, mirroring src/
```

- Imports go **top-down only**: `cli`, `hooks` → `io` → `lib` → `config` → `types`. A lower layer never imports a higher one; `cli` and `hooks` never import each other. `process` is used only in `io` and in the entry points (`cli`, `hooks`).
- ESLint enforces these rules (`eslint.config.js`): a wrong import direction, a relative import, `node:fs`/`process` in `lib`, a class, an `enum`, an `as` cast or an `export default` is a lint error.
- Imports use **only aliases**, never `./` or `../`: `@/` for `src/` (`import { nextAction } from "@/lib/next-action"`) and `@tests/` for test fixtures. Both are defined in `tsconfig.json → paths`; `tsx` resolves them at runtime.
- Import order: `node:` modules, then `@/…`, then `@tests/…`; a blank line after the `node:` group; `import type` goes right after the value import from the same group.
- **Named exports only.** No `export default`, except in tool configs that require it.
- Reusable code lives in its layer folder; helpers are never duplicated between the CLI and the hooks.

### Control flow and data

- Functions in `src/lib` that start with `record`, `apply`, `invalidate`, `mark` or `confirm` mutate the state object passed to them and never touch the disk; `src/io` persists the result.

- Early returns over nested `if`s.
- Derived data is computed, not stored (e.g. "is this run awaiting approval" is computed by `nextAction`, not saved as a flag).
- Errors are thrown as `Error` with an actionable message (what failed and what to do). No empty `catch`; a caught error is handled or re-thrown.

### Comments

- In **English** (see "Language" above), brief, and only where the "why" is not obvious. No comments in other languages.
- Reference gate ids and workflow invariants where relevant (`// G7: the total with contingency must not exceed the limit`).
- Prompts for agents, skills, artifacts, README and user-facing output are in English too.

## Tooling

- **All Claude Code configuration lives in `.claude/`** (`settings.json`, `mcp.json`, `agents/`, `commands/`, `skills/`); only `CLAUDE.md` stays in the root. Claude Code auto-discovers project MCP servers only in a root `.mcp.json`, so the session is started with `npm run claude` (= `claude --mcp-config=.claude/mcp.json`) from the repository root. For workflow runs use `npm run claude:run`: it adds `--setting-sources project,local` (no user-level plugins, output styles or other MCP servers in every coordinator turn), `--strict-mcp-config`, `--model sonnet` and `--permission-mode acceptEdits` (artifact writes and the allow-listed `wf` commands, web search and MCP tools run without the auto-mode classifier, whose outages stalled earlier runs; anything unexpected still asks).
- Node ≥ 22, TypeScript 6.0 (`typescript-eslint` supports `<6.1`). TypeScript runs without a build step through `tsx`: `node --import tsx <file>.ts`; the workflow CLI is `npm run -s wf -- <command>` (`-s` keeps stdout pure JSON). `.claude/settings.json` calls hooks the same way. Never through `npx` (Windows `.cmd` shims do not start without a shell).
- `npm run typecheck` (`tsc --noEmit`), `npm run lint` (ESLint 10 + `typescript-eslint` strict and stylistic type-checked), `npm run format` (Prettier 3, `printWidth: 120`), `npm test` (`node --import tsx --test "tests/**/*.test.ts"`).
- Tests: `node:test` + `node:assert/strict`; narrow optional values with `assert.ok(value)` before using them; CLI and hooks are tested as real processes (`tests/support/run-cli.ts`, `tests/support/run-hook.ts`).
- Run `npm run format` before every commit; the Husky pre-commit hook runs lint, format check, typecheck and tests.
- Never format or hand-edit `runs/**`: approval is bound to artifact sha256 hashes.
- **Cloud sessions** (claude.ai/code, `claude --cloud`) clone the repo onto a Linux VM; the `SessionStart` hook in `.claude/settings.json` runs `npm ci` there (only when `CLAUDE_CODE_REMOTE=true`). The project MCP servers (Open-Meteo, holidays) are not available in the cloud (they are loaded only via `--mcp-config`), so live workflow runs happen locally with `npm run claude:run`.
