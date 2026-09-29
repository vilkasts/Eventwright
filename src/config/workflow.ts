import { DAG } from "@/config/dag";
import type { AgentName, ArtifactArea, GatedStage } from "@/types/workflow";

export const MAX_RETRIES = DAG.maxRetries;
export const REQUIREMENTS_AGENT = "requirements-formalizer" satisfies AgentName;
export const BUDGET_AGENT = "budget-aggregator" satisfies AgentName;
export const PLAN_AGENT = "event-plan-builder" satisfies AgentName;
export const OUTPUT_AGENT = "html-builder" satisfies AgentName;
export const VALIDATOR_NAME = "validator";

// Стадии с quality gates в порядке выполнения.
export const STAGE_ORDER: readonly GatedStage[] = ["domain", "final"];

export const ARTIFACTS_AREA: ArtifactArea = "artifacts";
export const OUTPUT_AREA: ArtifactArea = "output";
export const VENUE_SERVICE = "venue";

export const SCHEMA_VERSION = 1;
export const RUNS_DIRECTORY = "runs";
export const STATE_FILE = "workflow-state.json";
export const APPROVAL_FILE = "approval.json";
export const HASH_PREVIEW_LENGTH = 12;
export const APPROVAL_RECORDED_BY = "UserPromptSubmit hook (record-approval)";

export const validationFileName = (stage: GatedStage): string => `validation-${stage}.md`;
