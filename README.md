# Eventwright

An agentic event-planning workflow for [Claude Code](https://docs.claude.com/en/docs/claude-code). Describe an event in one sentence — Eventwright collects and confirms the requirements, researches weather (Open-Meteo MCP), public holidays around the date (Nager.Date MCP), venues, catering, entertainment and logistics (web search), builds a budget, checks everything with named quality gates, asks for your approval and produces a ready-to-use plan as HTML and Markdown.

```
/plan-event 40th birthday dinner in Lisbon on 2027-06-12 for 30 guests. Budget 9000 EUR.
Rooftop or garden restaurant, live acoustic music, 3 vegetarians and 1 gluten-free guest,
one guest uses a wheelchair.
```

Output: `runs/<runId>/output/event-plan.html` and `event-plan.md` with the same nine sections every time — Overview · Weather & Plan B · Venue · Menu · Program · Run of Show · Preparation Checklist · Budget · Sources.

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

```
/plan-event <describe the event: occasion, date, city, guests, budget, wishes>
```

The coordinator creates a run (`runs/<YYYY-MM-DD>-<slug>/`), asks clarifying questions when information is missing, shows the requirements for your confirmation and then works through the agents, reporting progress in one line per step.

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

Four saved runs with inputs, artifacts and state are in `runs/`, each with a `SCENARIO.md`:

| Run | Scenario                                                                                          |
| --- | ------------------------------------------------------------------------------------------------- |
| A   | Happy path — climatology weather, parallel planners, approved at once                             |
| B   | Clarifying questions, a rejection that changes the venue, regeneration, second approval           |
| C   | Catering not requested (agent skipped), session interrupted and resumed, forecast weather         |
| D   | Budget cannot be met — the budget gate is blocked after 3 retries and the run stops with a report |

## How it works

```
[requirements] → clarify → execution plan → [weather] → [venue] → [catering ∥ entertainment ∥ logistics]
→ [budget] → quality gates G1–G9 → [plan synthesis] → gates G10–G12 → your approval → [HTML]
```

- A coordinator (slash command) and 10 single-responsibility subagents, each owning one artifact.
- The next step is computed by code (`npm run -s wf -- next`) from `src/config/dag.ts` and the saved state, not guessed by the model.
- Quality gates name the responsible agents; only they and their downstream re-run (at most 3 consecutive failures).
- Hooks keep state and approval tamper-proof and keep workflow internals out of the final document.

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
