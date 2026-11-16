import { test } from "node:test";
import assert from "node:assert/strict";
import { moveStep, groupSelected } from "../src/automation-sequence.ts";
const list = [
  { delayMs: 0, action: { type: "wait", ms: 1 } },
  { delayMs: 0, action: { type: "wait", ms: 2 } },
  { delayMs: 0, action: { type: "wait", ms: 3 } },
];
test("bulk grouping keeps action order and drag can move actions into and out of groups", () => {
  const grouped = groupSelected(list, [0, 1], "group");
  assert.deepEqual(
    grouped[0].action.steps.map((step) => step.action.ms),
    [1, 2],
  );
  const moved = moveStep(grouped, [1], [0], "inside");
  assert.deepEqual(
    moved[0].action.steps.map((step) => step.action.ms),
    [1, 2, 3],
  );
  const out = moveStep(moved, [0, 1], [0], "after");
  assert.deepEqual(
    out.map((step) => step.action.type),
    ["group", "wait"],
  );
  assert.equal(out[1].action.ms, 2);
});
test("nested group cannot be moved into itself and source stays intact", () => {
  const root = groupSelected(list, [0, 1], "group");
  assert.throws(() => moveStep(root, [0], [0, 0], "inside"));
  assert.throws(() => groupSelected(list, [0, 2], "would reorder"), /连续选择/);
  assert.deepEqual(
    list.map((step) => step.action.ms),
    [1, 2, 3],
  );
});
