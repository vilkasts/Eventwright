// A per-run lock, so that hooks and CLI calls running at the same time never overwrite each other's
// changes to workflow-state.json. The lock is a folder: creating a folder either succeeds or fails
// in one step on every operating system, so only one process can hold it.
import { mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import { runDirectory } from "@/io/paths";

// runs/<runId>/.lock exists while some process holds the lock.
const LOCK_DIRECTORY = ".lock";
// How long to wait between attempts to take the lock.
const RETRY_DELAY_MS = 20;
// Give up after this long and report which lock is stuck.
const LOCK_TIMEOUT_MS = 20_000;
// A lock older than this was left by a crashed process: hooks and CLI calls hold it for milliseconds.
// It must be shorter than LOCK_TIMEOUT_MS, or a waiter gives up before it may break a crashed holder's lock.
const STALE_LOCK_MS = 10_000;
// Memory cell used only to make the process wait without busy looping.
const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

// Pauses this process for a moment (synchronously; hooks and CLI commands are short synchronous programs).
const sleep = (milliseconds: number): void => {
  Atomics.wait(SLEEP_CELL, 0, 0, milliseconds);
};

// True when creating the lock folder failed because another process already holds the lock.
const isAlreadyLocked = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EEXIST";

// True when the lock is so old that its holder must have crashed.
const isStale = (lockPath: string): boolean => {
  try {
    return Date.now() - statSync(lockPath).mtimeMs > STALE_LOCK_MS;
  } catch (error) {
    // The holder released the lock between our mkdir and stat: not stale, just retry.
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
};

// Waits until the lock can be taken: retries, removes a crashed holder's lock, and gives up after the timeout.
const acquire = (lockPath: string): void => {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      mkdirSync(lockPath);
      return;
    } catch (error) {
      if (!isAlreadyLocked(error)) throw error;
    }
    if (isStale(lockPath)) rmSync(lockPath, { recursive: true, force: true });
    if (Date.now() > deadline) {
      throw new Error(`${lockPath} is held by another process — wait for it to finish or delete the folder.`);
    }
    sleep(RETRY_DELAY_MS);
  }
};

// Serializes load → mutate → save of one run across concurrent hook and CLI processes (mkdir is atomic).
// Runs `action` while holding the lock and always releases it afterwards, even if `action` throws.
export const withRunLock = <T>(runId: string, action: () => T): T => {
  const lockPath = path.join(runDirectory(runId), LOCK_DIRECTORY);
  acquire(lockPath);
  try {
    return action();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
};
