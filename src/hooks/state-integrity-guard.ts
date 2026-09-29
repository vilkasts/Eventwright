// PreToolUse: state and approval change only via the CLI and hooks; approval commands are human-only.
import { denyToolUse, readHookInput } from "@/io/hook-io";
import { stateIntegrityViolation } from "@/lib/guards/state-integrity";

const violation = stateIntegrityViolation(await readHookInput());
if (violation !== null) denyToolUse(violation);
