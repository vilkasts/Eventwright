import assert from "node:assert/strict";
import { test } from "node:test";

import { findLeaks } from "@/lib/guards/leaks";

test("lists every internal detail once", () => {
  assert.deepEqual(findLeaks("See 03-venues.md from venue-scout; venue-scout again"), ["03-venues.md", "venue-scout"]);
});

test("catches tool names, run paths and state files", () => {
  const leaks = findLeaks(
    "mcp__open-meteo__geocoding, runs/2026-09-28-x, workflow-state.json, open-meteo:weather_archive",
  );
  assert.deepEqual(leaks, [
    "workflow-state.json",
    "runs/2026-09-28-x",
    "mcp__open-meteo__geocoding",
    "open-meteo:weather_archive",
  ]);
});

test("allows clean user-facing text", () => {
  assert.deepEqual(findLeaks("Venue: Rooftop 360. Weather source: Open-Meteo historical weather (2016–2025)."), []);
});
