import { DAG } from "@/config/dag";
import { GATE_IDS } from "@/types/workflow";
import type { GatedStage, GateId } from "@/types/workflow";

// Validator report: every gate of the stage is PASS except the listed ones (gate → owners named by the validator).
export const gateReport = (stage: GatedStage, failing: Partial<Record<GateId, string>> = {}): string =>
  [
    "## Gate results",
    "| Gate | Status | Owners | Finding |",
    "|---|---|---|---|",
    ...GATE_IDS.filter((id) => DAG.gates[id].stage === stage).map((id) => {
      const owners = failing[id];
      return owners === undefined
        ? `| ${id} | PASS | ${DAG.gates[id].owners.join(", ")} | — |`
        : `| ${id} | FAIL | ${owners} | problem in ${id} |`;
    }),
  ].join("\n");

export const withoutGateRow = (report: string, id: GateId): string =>
  report
    .split("\n")
    .filter((line) => !line.includes(`| ${id} |`))
    .join("\n");
