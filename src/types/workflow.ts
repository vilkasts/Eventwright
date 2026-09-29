// Name tuples are the single source of literals; the types below are derived from them.
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

export const SERVICES = ["catering", "entertainment", "logistics"] as const;
export type Service = (typeof SERVICES)[number];
export type RequestedService = Service | "venue";

export const AGENT_STATUSES = ["pending", "running", "done", "stale", "skipped"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const GATE_STATUSES = ["pending", "pass", "fail", "blocked", "n/a"] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

export type Stage = "domain" | "final" | "output";
export type GatedStage = Exclude<Stage, "output">;
export type ArtifactArea = "artifacts" | "output";
export type BriefMode = "initial" | "retry" | "revise";

type AgentDefinitionBase = {
  readonly deps: readonly AgentName[];
  readonly stage: Stage;
  readonly service?: Service;
};

export type ArtifactAgentDefinition = AgentDefinitionBase & {
  readonly kind: "artifact";
  readonly artifact: string;
  readonly sections: readonly string[];
  readonly requiredLines: readonly string[];
  // Labels of money lines that must be '- <Label>: <amount> <CUR>' (or 'unknown' in a draft); G7 parses them.
  readonly moneyLines?: readonly string[];
  readonly coversRequirements?: true;
};

export type OutputAgentDefinition = AgentDefinitionBase & {
  readonly kind: "output";
  readonly outputs: readonly string[];
};

export type AgentDefinition = ArtifactAgentDefinition | OutputAgentDefinition;

export type GateDefinition = {
  readonly stage: GatedStage;
  readonly owners: readonly AgentName[];
};

export type Dag = {
  readonly maxRetries: number;
  readonly agents: Readonly<Record<AgentName, AgentDefinition>>;
  readonly gates: Readonly<Record<GateId, GateDefinition>>;
};

export type AgentState = {
  status: AgentStatus;
  attempts: number;
  startsWithoutArtifact: number;
  structuralFailures: number;
  structureOk: boolean;
  sha256: string | null;
  updatedAt: string | null;
  lastError: string | null;
  feedback: string | null;
  outputs: Record<string, string>;
};

export type GateState = {
  status: GateStatus;
  attempts: number;
  findings: string[];
};

export type ValidationRecord = {
  sha256: string | null;
  recorded: boolean;
  at: string;
  // Who wrote the report (post-write-state); absent in runs recorded before the field existed.
  writer?: string;
};

export type ExecutionPlan = {
  services: RequestedService[];
  selected: AgentName[];
  skipped: AgentName[];
  at: string;
};

export type Failure =
  | { kind: "gate"; gate: GateId; findings: string[]; attempts: number; at: string }
  | { kind: "agent"; agent: AgentName; findings: string[]; attempts: number; at: string };

export type LogEntry = {
  at: string;
  event: string;
  details: Record<string, unknown>;
};

export type Brief = {
  name: AgentName;
  artifact: string | null;
  inputs: string[];
  mode: BriefMode;
  reason: string | null;
  feedback: string | null;
};

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

export type WorkflowState = {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  updatedAt: string;
  phase: ActionName | "init";
  requirementsConfirmed: boolean;
  plan: ExecutionPlan | null;
  failure: Failure | null;
  agents: Record<AgentName, AgentState>;
  gates: Record<GateId, GateState>;
  validation: Record<GatedStage, ValidationRecord | null>;
  log: LogEntry[];
};

export type RunLocation = {
  runId: string;
  area: ArtifactArea;
  fileName: string;
};

export type GateSummary = {
  passed: GateId[];
  failed: { id: GateId; owners: AgentName[] }[];
  blocked: GateId[];
};
