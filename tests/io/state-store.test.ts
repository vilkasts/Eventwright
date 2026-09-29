import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { statePath } from "@/io/paths";
import { createRun, listRunIds, loadState, saveState, stateExists } from "@/io/state-store";
import { createInitialState } from "@/lib/state";
import { NOW } from "@tests/support/state-fixtures";
import { useTempProject } from "@tests/support/temp-project";

const RUN = "2026-09-28-lisbon";

beforeEach(() => {
  useTempProject();
});

test("createRun persists the initial state and lists the run", () => {
  createRun(createInitialState(RUN, NOW));
  assert.deepEqual(listRunIds(), [RUN]);
  assert.equal(loadState(RUN).runId, RUN);
});

test("saveState writes atomically and loadState reads it back", () => {
  const state = createInitialState(RUN, NOW);
  createRun(state);
  state.requirementsConfirmed = true;
  saveState(state, NOW);
  assert.equal(existsSync(`${statePath(RUN)}.tmp`), false);
  assert.deepEqual(loadState(RUN), state);
});

test("a corrupted state file is rejected with the file path", () => {
  createRun(createInitialState(RUN, NOW));
  writeFileSync(statePath(RUN), JSON.stringify({ runId: RUN }));
  assert.throws(() => loadState(RUN), /not a valid workflow state/);
});

test("run ids outside lowercase kebab-case never resolve to a path (F10)", () => {
  assert.equal(stateExists("../escape"), false);
  assert.throws(() => loadState("../escape"), /Invalid run id/);
});

test("a state file that names another run is rejected (F10)", () => {
  createRun(createInitialState(RUN, NOW));
  writeFileSync(statePath(RUN), JSON.stringify(createInitialState("2026-09-28-other", NOW)));
  assert.throws(() => loadState(RUN), /belongs to run '2026-09-28-other'/);
});
