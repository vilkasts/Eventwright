// PreToolUse: состояние и одобрение меняют только CLI и hooks; команды одобрения — только человек.
import { denyToolUse, readHookInput } from "@/io/hook-io";
import { stateIntegrityViolation } from "@/lib/guards/state-integrity";

const violation = stateIntegrityViolation(await readHookInput());
if (violation !== null) denyToolUse(violation);
