// PreToolUse: state and approval change only via the CLI and hooks; approval commands are human-only.
import { guardToolUse } from "@/io/hook-io";
import { stateIntegrityViolation } from "@/lib/guards/state-integrity";

await guardToolUse("state-integrity-guard", stateIntegrityViolation);
