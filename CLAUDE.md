# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Eventwright is an agentic event-planning workflow for Claude Code: a `/plan-event` coordinator, single-responsibility subagents, quality gates with targeted retries, deterministic human approval and resumable state. The workflow description and its execution rules are added in a later section. This file currently holds the code rules.

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

- In **Russian** (the user reads the code), brief, and only where the "why" is not obvious.
- Reference gate ids and workflow invariants where relevant (`// G7: итог с резервом не должен превышать лимит`).
- Prompts for agents, skills, artifacts, README and user-facing output stay in English.

## Tooling

- **All Claude Code configuration lives in `.claude/`** (`settings.json`, `mcp.json`, `agents/`, `commands/`, `skills/`); only `CLAUDE.md` stays in the root. Claude Code auto-discovers project MCP servers only in a root `.mcp.json`, so the session is started with `npm run claude` (= `claude --mcp-config=.claude/mcp.json`) from the repository root.
- Node ≥ 22, TypeScript 6.0 (`typescript-eslint` supports `<6.1`). TypeScript runs without a build step through `tsx`: `node --import tsx <file>.ts`; the workflow CLI is `npm run -s wf -- <command>` (`-s` keeps stdout pure JSON). `.claude/settings.json` calls hooks the same way. Never through `npx` (Windows `.cmd` shims do not start without a shell).
- `npm run typecheck` (`tsc --noEmit`), `npm run lint` (ESLint 10 + `typescript-eslint` strict and stylistic type-checked), `npm run format` (Prettier 3, `printWidth: 120`), `npm test` (`node --import tsx --test "tests/**/*.test.ts"`).
- Tests: `node:test` + `node:assert/strict`; narrow optional values with `assert.ok(value)` before using them; CLI and hooks are tested as real processes (`tests/support/run-cli.ts`, `tests/support/run-hook.ts`).
- Run `npm run format` before every commit; the Husky pre-commit hook runs lint, format check, typecheck and tests.
- Never format or hand-edit `runs/**`: approval is bound to artifact sha256 hashes.
- **Cloud sessions** (claude.ai/code, `claude --cloud`) clone the repo onto a Linux VM; the `SessionStart` hook in `.claude/settings.json` runs `npm ci` there (only when `CLAUDE_CODE_REMOTE=true`). The Open-Meteo MCP server is not available in the cloud (it is loaded only via `--mcp-config`), so live workflow runs happen locally with `npm run claude`.
