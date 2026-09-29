import assert from "node:assert/strict";
import { test } from "node:test";

import { parseHookInput } from "@/lib/hook-input";

test("normalizes a Write payload", () => {
  const input = parseHookInput({
    tool_name: "Write",
    agent_type: "venue-scout",
    tool_input: { file_path: "/p/runs/r/artifacts/03-venues.md", content: "# Venues" },
  });
  assert.equal(input.toolName, "Write");
  assert.equal(input.filePath, "/p/runs/r/artifacts/03-venues.md");
  assert.equal(input.writtenText, "# Venues");
  assert.equal(input.agentType, "venue-scout");
});

test("collects the text of every MultiEdit replacement", () => {
  const input = parseHookInput({
    tool_name: "MultiEdit",
    tool_input: { edits: [{ new_string: "a" }, { new_string: "b" }, 7] },
  });
  assert.equal(input.writtenText, "a\nb");
});

test("reads the prompt from prompt or prompt_text", () => {
  assert.equal(parseHookInput({ prompt: "/approve-event r" }).prompt, "/approve-event r");
  assert.equal(parseHookInput({ prompt_text: "/approve-event r" }).prompt, "/approve-event r");
});

test("tolerates malformed payloads", () => {
  const input = parseHookInput(["not", "an", "object"]);
  assert.equal(input.toolName, null);
  assert.equal(input.writtenText, "");
});
