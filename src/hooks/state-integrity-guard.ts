// PreToolUse: state and approval change only via the CLI and hooks; approval commands are human-only;
// an artifact is written only by the agent that owns it.
import { guardToolUse } from "@/io/hook-io";
import { artifactOwnerViolation } from "@/lib/guards/artifact-owner";
import { stateIntegrityViolation } from "@/lib/guards/state-integrity";

await guardToolUse("state-integrity-guard", (input) => stateIntegrityViolation(input) ?? artifactOwnerViolation(input));
