// Shared domain types of the workflow: agents, gates, run state and the actions the coordinator executes.
// This file imports nothing; every other layer builds on these names.

// Name tuples are the single source of literals; the types below are derived from them.
// The subagents that produce content. The validator is not listed: it checks work but owns no step in the graph.
export const AGENT_NAMES = [
  "requirements-formalizer",
  "weather-analyst",
  "venue-scout",
  "catering-planner",
  "entertainment-planner",
  "logistics-planner",
  "budget-aggregator",
  "event-plan-builder",
  "html-builder",
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

// The named quality gates. G1–G9 check the domain artifacts, G10–G12 check the final plan.
export const GATE_IDS = [
  "G1-requirements-complete",
  "G2-sources-cited",
  "G3-weather-grounded",
  "G4-venue-fit",
  "G5-dietary-coverage",
  "G6-weather-plan-b",
  "G7-budget-within-limit",
  "G8-currency-consistent",
  "G9-must-haves-covered",
  "G10-plan-covers-requirements",
  "G11-plan-consistent-with-artifacts",
  "G12-timeline-feasible",
] as const;
export type GateId = (typeof GATE_IDS)[number];

// Optional services: a planner for each of them runs only if the user needs that service.
export const SERVICES = ["catering", "entertainment", "logistics"] as const;
export type Service = (typeof SERVICES)[number];
// What the "- Services:" line may list. The venue is always planned.
export type RequestedService = Service | "venue";

// Life cycle of an agent: pending (never run) → running → done; stale = must run again; skipped = not needed.
export const AGENT_STATUSES = ["pending", "running", "done", "stale", "skipped"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

// Life cycle of a gate: pending → pass or fail; blocked = too many failures in a row; n/a = all owners skipped.
export const GATE_STATUSES = ["pending", "pass", "fail", "blocked", "n/a"] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

// Where in the workflow an agent works: domain research, the final plan, or the rendered output.
export type Stage = "domain" | "final" | "output";
// Stages that are checked by gates (the output is not validated, it needs human approval instead).
export type GatedStage = Exclude<Stage, "output">;
// The two folders of a run that agents write into.
export type ArtifactArea = "artifacts" | "output";
// Why an agent is launched: first time, to fix a failed check, or to apply human feedback.
export type BriefMode = "initial" | "retry" | "revise";

// Fields every agent definition in src/config/dag.ts has.
type AgentDefinitionBase = {
  // Agents whose artifacts this agent reads; it can start only after they are done.
  readonly deps: readonly AgentName[];
  readonly stage: Stage;
  // Set for optional planners: the agent runs only if this service is requested.
  readonly service?: Service;
};

// An agent that writes one Markdown artifact into runs/<runId>/artifacts/.
export type ArtifactAgentDefinition = AgentDefinitionBase & {
  readonly kind: "artifact";
  // File name of the artifact, e.g. "03-venues.md".
  readonly artifact: string;
  // The "## " sections the artifact must have, in this order (between the common Meta/Summary and Sources/Open questions).
  readonly sections: readonly string[];
  // Line prefixes that must appear somewhere in the artifact, e.g. "- Budget:".
  readonly requiredLines: readonly string[];
  // Labels of money lines that must be '- <Label>: <amount> <CUR>' (or 'unknown' in a draft); G7 parses them.
  readonly moneyLines?: readonly string[];
  // True for the final plan: it must mention every requirement id (R-01, R-02, …).
  readonly coversRequirements?: true;
};

// An agent that renders the user-facing files into runs/<runId>/output/.
export type OutputAgentDefinition = AgentDefinitionBase & {
  readonly kind: "output";
  readonly outputs: readonly string[];
};

export type AgentDefinition = ArtifactAgentDefinition | OutputAgentDefinition;

// A quality gate: the stage it checks and the agents that must fix it when it fails.
export type GateDefinition = {
  readonly stage: GatedStage;
  readonly owners: readonly AgentName[];
};

// The whole workflow graph (the shape of DAG in src/config/dag.ts).
export type Dag = {
  // How many consecutive failures of a gate, check or agent start are retried before the run stops.
  readonly maxRetries: number;
  readonly agents: Readonly<Record<AgentName, AgentDefinition>>;
  readonly gates: Readonly<Record<GateId, GateDefinition>>;
};

// Everything the workflow remembers about one agent in one run.
export type AgentState = {
  status: AgentStatus;
  // How many times the agent was started in this run.
  attempts: number;
  // Starts in a row without a recorded artifact write; too many stop the run.
  startsWithoutArtifact: number;
  // Structure checks in a row that failed; too many stop the run.
  structuralFailures: number;
  // True once the current artifact passed the structure check (wf check).
  structureOk: boolean;
  // sha256 of the artifact as last written, or null if never written.
  sha256: string | null;
  updatedAt: string | null;
  // Why the agent must run again (failed check or gate); shown to the agent on a retry.
  lastError: string | null;
  // The human's feedback after a rejection; shown to the agent in revise mode.
  feedback: string | null;
  // html-builder only: sha256 of each output file written in the current round.
  outputs: Record<string, string>;
};

// Everything the workflow remembers about one gate in one run.
export type GateState = {
  status: GateStatus;
  // Failures in a row; a PASS resets it to 0.
  attempts: number;
  // The validator's last finding for this gate.
  findings: string[];
};

// The validator report of one stage (validation-domain.md or validation-final.md).
export type ValidationRecord = {
  // sha256 of the report file as written by the validator.
  sha256: string | null;
  // True once `wf record-gates` has applied the report to the gates.
  recorded: boolean;
  at: string;
  // Who wrote the report (post-write-state); absent in runs recorded before the field existed.
  writer?: string;
};

// Which agents run in this run, decided from the confirmed "- Services:" line (wf plan).
export type ExecutionPlan = {
  services: RequestedService[];
  selected: AgentName[];
  skipped: AgentName[];
  at: string;
};

// Why a run stopped: a gate or an agent failed more often than the retry limit allows.
export type Failure =
  | { kind: "gate"; gate: GateId; findings: string[]; attempts: number; at: string }
  | { kind: "agent"; agent: AgentName; findings: string[]; attempts: number; at: string };

// One line of the run's history (workflow-state.json → log).
export type LogEntry = {
  at: string;
  event: string;
  details: Record<string, unknown>;
};

// What the coordinator tells an agent when it launches it.
export type Brief = {
  name: AgentName;
  // The file the agent must write (null for html-builder, which writes to output/).
  artifact: string | null;
  // Artifacts of the agent's dependencies that it should read.
  inputs: string[];
  mode: BriefMode;
  // For retry mode: what was wrong last time.
  reason: string | null;
  // For revise mode: the human's feedback.
  feedback: string | null;
};

// The next step of a run, computed by nextAction and printed by `wf next`. The coordinator only executes it.
export type Action =
  | { action: "failed"; failure: Failure }
  | { action: "check"; agents: AgentName[] }
  | { action: "run"; agents: Brief[] }
  | { action: "clarify" }
  | { action: "plan" }
  | { action: "validate"; stage: GatedStage; recheck: GateId[]; notApplicable: GateId[] }
  | { action: "record-gates"; stage: GatedStage }
  | { action: "await-approval"; planSha256: string | null }
  | { action: "done"; outputs: readonly string[] };

export type ActionName = Action["action"];

// The complete persisted state of one run: runs/<runId>/workflow-state.json.
export type WorkflowState = {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  updatedAt: string;
  // The last action returned by `wf next` (for humans and `wf list`; the real next step is always recomputed).
  phase: ActionName | "init";
  // True after the human confirmed the requirements in the clarify phase.
  requirementsConfirmed: boolean;
  plan: ExecutionPlan | null;
  // Set when the run stopped; nothing else runs afterwards.
  failure: Failure | null;
  agents: Record<AgentName, AgentState>;
  gates: Record<GateId, GateState>;
  validation: Record<GatedStage, ValidationRecord | null>;
  log: LogEntry[];
};

// A file inside a run, parsed from an absolute path (see parseRunPath).
export type RunLocation = {
  runId: string;
  area: ArtifactArea;
  fileName: string;
};

// The result of `wf record-gates`: which gates passed, which failed (and who must fix them), which are blocked.
export type GateSummary = {
  passed: GateId[];
  failed: { id: GateId; owners: AgentName[] }[];
  blocked: GateId[];
};
