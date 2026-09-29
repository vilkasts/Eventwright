# Eventwright

An agentic event-planning workflow for [Claude Code](https://docs.claude.com/en/docs/claude-code). Describe an event in one sentence — Eventwright collects and confirms the requirements, researches weather (Open-Meteo MCP), public holidays around the date (Nager.Date MCP), venues, catering, entertainment and logistics (web search), builds a budget, checks everything with named quality gates, asks for your approval and produces a ready-to-use plan as HTML and Markdown.

```
/plan-event 40th birthday dinner in Lisbon on 2027-06-12 for 30 guests. Budget 9000 EUR.
Rooftop or garden restaurant, live acoustic music, 3 vegetarians and 1 gluten-free guest,
one guest uses a wheelchair.
```

Output: `runs/<runId>/output/event-plan.html` and `event-plan.md` ([example](runs/2026-09-29-lisbon-40th-birthday/output/event-plan.html)) with the same nine sections every time — Overview · Weather & Plan B · Venue · Menu · Program · Run of Show · Preparation Checklist · Budget · Sources.

## Prerequisites

- Node.js ≥ 22 and npm
- Git
- Claude Code (current version), signed in with your Claude account

## Setup

```bash
git clone https://github.com/vilkasts/Eventwright.git
cd Eventwright
npm install
npm run claude
```

`npm run claude` starts Claude Code with `--mcp-config=.claude/mcp.json`; all Claude Code settings (hooks, permissions, agents, commands, skills, MCP) live in `.claude/`. Accept the project trust prompt, then check `/mcp` — `open-meteo` and `holidays` should be **connected**. Both MCP servers are regular npm dependencies started from `node_modules`; nothing is installed globally.

## Environment and secrets

No secrets are needed:

- Claude Code uses your own Claude login — no API key.
- The Open-Meteo MCP server uses the free public Open-Meteo API — no key.
- The holidays MCP server ([@pipeworx/mcp-holidays](https://github.com/pipeworx-io/mcp-holidays)) uses the free public [Nager.Date](https://date.nager.at) API — no key.
- Web research uses Claude Code's built-in WebSearch/WebFetch.

`.env.example` documents this; `.env*` files are git-ignored.

## Run

For workflow runs start the session with `npm run claude:run` instead of `npm run claude`: it loads only this project's settings and MCP servers (no user-level plugins or output styles) and uses Sonnet, which keeps every coordinator turn small. It starts in `acceptEdits` permission mode: agents write their artifacts and run the allow-listed workflow commands without prompts; anything else asks you first.

```
/plan-event <describe the event: occasion, date, city, guests, budget, wishes>
```

The coordinator creates a run (`runs/<YYYY-MM-DD>-<slug>/`), asks clarifying questions when information is missing, shows the requirements for your confirmation and then works through the agents, reporting progress in one line per step.

### Time and usage

A full run launches about 12 subagents with web research and takes roughly 20 minutes. The coordinator is pinned to Sonnet (`model: sonnet` in the slash commands) and the subagents run on Sonnet as well, so a run does not consume Opus usage even if your session model is Opus. Rejections and gate retries regenerate only the affected agents, but still add to the run's usage.

## Approve or reject

When the plan has passed all quality gates the coordinator shows a summary and stops. Type one of:

```
/approve-event <runId>
/reject-event <runId> <what to change>
```

Only a command typed by you counts: a `UserPromptSubmit` hook records the decision in `approval.json`, bound to the sha256 of the plan. A rejection is applied (the affected agents and everything downstream are regenerated) and the plan comes back for approval.

## Resume

Progress is saved after every step. If the session is interrupted:

```
/resume-event [runId]        # without runId: the latest unfinished run
npm run -s wf -- list        # all runs
npm run -s wf -- status <runId>
```

Finished agents are never re-run; an interrupted agent is restarted.

## Output and run folder

```
runs/<runId>/
  input.md               the original request
  clarifications.md      questions and your answers
  artifacts/             01-requirements.md … 08-event-plan.md, validation-*.md
  workflow-state.json    agents, gates, execution plan, log (written only by the CLI and hooks)
  approval.json          your decisions with plan hashes (written only by the approval hook)
  output/                event-plan.html, event-plan.md
```

## Sample runs

Four saved runs with inputs, artifacts, validator reports, state and approvals are in `runs/`. Each has a `SCENARIO.md` with the goal, what the human did and the key events from its log.

| Run | Folder                                                                                                | Scenario                                                                                                                                                                     | Result                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A   | [`2026-09-29-lisbon-40th-birthday`](runs/2026-09-29-lisbon-40th-birthday/SCENARIO.md)                 | Happy path: 10-year climatology, three planners in parallel, targeted retries after G2 and G7, approved at once                                                              | done — [event-plan.html](runs/2026-09-29-lisbon-40th-birthday/output/event-plan.html)         |
| B   | [`2026-09-29-new-year-team-party`](runs/2026-09-29-new-year-team-party/SCENARIO.md)                   | Almost empty request → clarifying questions; session interrupted and resumed; rejection ("second venue, photo booth") → upstream invalidation, regeneration, second approval | done — [event-plan.html](runs/2026-09-29-new-year-team-party/output/event-plan.html)          |
| C   | [`2026-09-29-kids-birthday-barcelona-park`](runs/2026-09-29-kids-birthday-barcelona-park/SCENARIO.md) | Catering not requested → planner skipped, G5 `n/a`; forecast weather; indoor venue after an `indoor-recommended` verdict                                                     | done — [event-plan.html](runs/2026-09-29-kids-birthday-barcelona-park/output/event-plan.html) |
| D   | [`2026-09-29-paris-wedding-150-chateau`](runs/2026-09-29-paris-wedding-150-chateau/SCENARIO.md)       | 150-guest château wedding for 5000 EUR: the budget gate fails 4 times, is blocked and the run stops with a report                                                            | failed — no plan, no approval, no output (by design)                                          |

## How it works

```
[requirements] → clarify → execution plan → [weather] → [venue] → [catering ∥ entertainment ∥ logistics]
→ [budget] → quality gates G1–G9 → [plan synthesis] → gates G10–G12 → your approval → [HTML]
```

- A coordinator (slash command) and 10 single-responsibility subagents, each owning one artifact.
- The next step is computed by code (`npm run -s wf -- next`) from `src/config/dag.ts` and the saved state, not guessed by the model.
- Quality gates name the responsible agents; only they and their downstream re-run (at most 3 consecutive failures).
- Hooks keep state and approval tamper-proof and keep workflow internals out of the final document.

### Design notes

**Two levels of gates.** Every artifact passes a deterministic structure gate (`npm run -s wf -- check`: required sections and lines, citations, no placeholders, rewritten since the agent started) **before the next group starts** — a group never builds on a malformed or unwritten input. The domain gates G1–G9 need the whole picture (the budget gate compares the sum of all planners with the limit; the venue gate needs the weather verdict and the guest list), so the validator checks them once all domain artifacts exist, and G10–G12 once the plan exists. A failing gate re-runs only its owners and their downstream.

**Why deterministic checks and JSON state.** Artifacts are plain Markdown for people and agents. What must not depend on a model's judgment is decided by code: the next step, retry limits, the budget arithmetic of G7, the structure of each artifact and the approval bound to the plan's sha256. In the demo runs this caught real failures that a model had reported as done — an artifact written through a shell script instead of the Write tool, and claims that were not on the cited page — and kept the workflow resumable after an interrupted session.

### Known limitations

Deliberate trade-offs, kept after the final code review:

- **One process per hook.** Every Write starts three PreToolUse guards and one PostToolUse hook as separate `node --import tsx` processes (about 0.3 s each). Separate named guards keep the PreToolUse/PostToolUse design visible; the run lock makes their concurrent state updates safe.
- **The state log is never trimmed.** `workflow-state.json → log` keeps every event of a run: it is the evidence behind each `SCENARIO.md`. A run writes tens of kilobytes.
- **Shell guards match file names, not globs.** A shell command that reaches `approval.json` or `workflow-state.json` through a wildcard (`approval.js?n`) is not recognized; such commands are not allow-listed, so Claude Code still asks the human.
- **Reading the output folder with a redirect is denied before approval** (`ls runs/<id>/output 2>/dev/null`): the guard treats `>` as a write. The folder is empty until the plan is approved.
- **A lock left by a crashed process** is broken after 10 s; if two waiting processes break it in the same moment, both may proceed once.

Workflow architecture, gates and execution rules: [CLAUDE.md](CLAUDE.md).

## Development

```bash
npm test            # node:test suites
npm run typecheck   # strict TypeScript
npm run lint        # ESLint with layer rules
npm run format      # Prettier
```

## License

MIT — see [LICENSE](LICENSE).
