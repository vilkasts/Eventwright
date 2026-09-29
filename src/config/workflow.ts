// Named constants of the workflow: special agents, stages, folder and file names.
import { DAG } from "@/config/dag";
import type { AgentName, ArtifactArea, GatedStage } from "@/types/workflow";

export const MAX_RETRIES = DAG.maxRetries;
// Agents with a special role; `satisfies` checks the name exists while keeping the exact literal type.
export const REQUIREMENTS_AGENT = "requirements-formalizer" satisfies AgentName;
export const BUDGET_AGENT = "budget-aggregator" satisfies AgentName;
export const PLAN_AGENT = "event-plan-builder" satisfies AgentName;
export const OUTPUT_AGENT = "html-builder" satisfies AgentName;
// The checking subagent; it is not part of AGENT_NAMES because it owns no step of the graph.
export const VALIDATOR_NAME = "validator";

// Stages with quality gates, in execution order.
export const STAGE_ORDER: readonly GatedStage[] = ["domain", "final"];

// Folder names inside runs/<runId>/.
export const ARTIFACTS_AREA: ArtifactArea = "artifacts";
export const OUTPUT_AREA: ArtifactArea = "output";
// The service that is always planned (every event needs a place).
export const VENUE_SERVICE = "venue";

// Version of the workflow-state.json format.
export const SCHEMA_VERSION = 1;
export const RUNS_DIRECTORY = "runs";
export const STATE_FILE = "workflow-state.json";
export const APPROVAL_FILE = "approval.json";
// How many characters of a sha256 are shown in logs and messages.
export const HASH_PREVIEW_LENGTH = 12;
export const APPROVAL_RECORDED_BY = "UserPromptSubmit hook (record-approval)";

// File name of the validator report for a stage, e.g. "validation-domain.md".
export const validationFileName = (stage: GatedStage): string => `validation-${stage}.md`;
