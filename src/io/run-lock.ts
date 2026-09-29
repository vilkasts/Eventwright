import { mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import { runDirectory } from "@/io/paths";

const LOCK_DIRECTORY = ".lock";
const RETRY_DELAY_MS = 20;
const LOCK_TIMEOUT_MS = 20_000;
// A lock older than this was left by a crashed process: hooks and CLI calls hold it for milliseconds.
// It must be shorter than LOCK_TIMEOUT_MS, or a waiter gives up before it may break a crashed holder's lock.
const STALE_LOCK_MS = 10_000;
const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

const sleep = (milliseconds: number): void => {
  Atomics.wait(SLEEP_CELL, 0, 0, milliseconds);
};

const isAlreadyLocked = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EEXIST";

const isStale = (lockPath: string): boolean => {
  try {
    return Date.now() - statSync(lockPath).mtimeMs > STALE_LOCK_MS;
  } catch (error) {
    // The holder released the lock between our mkdir and stat: not stale, just retry.
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
};

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
export const withRunLock = <T>(runId: string, action: () => T): T => {
  const lockPath = path.join(runDirectory(runId), LOCK_DIRECTORY);
  acquire(lockPath);
  try {
    return action();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
};
