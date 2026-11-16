import { test } from "node:test";
import assert from "node:assert/strict";
import { createBlockEditor } from "../src/automation-block-editor.ts";
import {
  parseBlocks,
  bindingBefore,
  writeBlocks,
  moveBlock,
  newBlock,
} from "../src/automation-block-model.ts";
const step = (type, fields = {}, delayMs = 0) => ({
  delayMs,
  action: { type, ...fields },
});
test("running block editor refuses insert commands without changing the script", () => {
  let changes = 0;
  const editor = createBlockEditor(
    {},
    {
      names: {},
      running: () => true,
      change: () => changes++,
      update: () => changes++,
      notify: () => {},
      slots: () => [],
    },
  );
  editor.insert(step("wait", { ms: 100 }));
  assert.equal(changes, 0);
});
const fixture = [
  step("loop", { count: 3 }, 12),
  step("if", { expression: "a > 0" }),
  step("click", { target: "B", x: 2, y: 3, button: "left" }),
  step("elseIf", { expression: "a == 0" }, 7),
  step("wait", { ms: 5 }),
  step("else"),
  step("group", {
    name: "g",
    steps: [step("text", { target: "C", text: "hello" })],
  }),
  step("endIf", {}, 8),
  step("endLoop", {}, 9),
  step("comment", { text: "end" }),
];
test("block view round trips nested loops, branches and groups without changing fields or delays", () => {
  const blocks = parseBlocks(fixture);
  assert.deepEqual(writeBlocks(blocks), fixture);
  assert.equal(blocks[0].branches[0].blocks[0].branches[1].index, 3);
  assert.equal(blocks[0].tailIndex, 8);
});
test("folding is view state and never enters stored scripts, including after moving a folded container", () => {
  const blocks = parseBlocks(fixture);
  blocks[0].collapsed = true;
  blocks[0].branches[0].blocks[0].collapsed = true;
  assert.deepEqual(writeBlocks(blocks), fixture);
  const moved = moveBlock(blocks, [0], [], 2);
  assert.equal(moved[1].collapsed, true);
  assert.equal(moved[1].branches[0].blocks[0].collapsed, true);
  const restored = parseBlocks(writeBlocks(moved));
  assert.equal(restored[1].collapsed, undefined);
  assert.deepEqual(writeBlocks(restored).slice(1), fixture.slice(0, -1));
});
test("drag moves complete control structures and rejects placing a container inside itself", () => {
  const source = parseBlocks(fixture);
  const moved = moveBlock(source, [0], [], 2);
  assert.equal(moved[1].step.action.type, "loop");
  assert.deepEqual(writeBlocks(moved).slice(1), fixture.slice(0, -1));
  const inside = moveBlock(source, [1], [0, 0], 1);
  assert.equal(inside[0].branches[0].blocks[1].step.action.type, "comment");
  assert.throws(() => moveBlock(source, [0], [0, 0], 0), /自身/);
  assert.deepEqual(writeBlocks(source), fixture);
});
test("new control blocks include closing markers and malformed branches do not silently lose steps", () => {
  assert.deepEqual(writeBlocks([newBlock(step("loop", { count: 0 }))]), [
    step("loop", { count: 0 }),
    step("endLoop"),
  ]);
  assert.deepEqual(
    writeBlocks([newBlock(step("if", { expression: "true" }))]),
    [step("if", { expression: "true" }), step("endIf")],
  );
  assert.throws(
    () => parseBlocks([step("loop", { count: 1 }), step("wait", { ms: 1 })]),
    /缺少/,
  );
  assert.throws(() => parseBlocks([step("else")]), /不匹配/);
  assert.throws(
    () =>
      parseBlocks([
        step("if", { expression: "true" }),
        step("else"),
        step("elseIf", { expression: "true" }),
        step("endIf"),
      ]),
    /否则/,
  );
  assert.throws(
    () =>
      parseBlocks([
        ...Array.from({ length: 34 }, () => step("loop", { count: 1 })),
        step("wait", { ms: 1 }),
        ...Array.from({ length: 34 }, () => step("endLoop")),
      ]),
    /嵌套/,
  );
});

test("window aliases resolve only preceding setup steps and update after rebinding", () => {
  const blocks = parseBlocks([
    step("focus", { target: "A" }),
    step("setWindow", { target: "A", title: "ChatGPT" }),
    step("focus", { target: "A" }),
    step("group", {
      name: "switch",
      steps: [step("setWindow", { target: "A", title: "Editor" })],
    }),
    step("focus", { target: "A" }),
  ]);
  assert.deepEqual(bindingBefore(blocks, blocks[0].step, "A"), {
    dynamic: true,
    title: undefined,
  });
  assert.equal(bindingBefore(blocks, blocks[2].step, "A").title, "ChatGPT");
  assert.equal(bindingBefore(blocks, blocks[4].step, "A").title, "Editor");
  assert.equal(bindingBefore(blocks, blocks[4].step, "B").dynamic, false);
  assert.equal(writeBlocks(blocks)[1].action.title, "ChatGPT");
});

test("annotations stay attached through nested block serialization", () => {
  const steps = [{ delayMs: 0, annotation: "组说明", action: { type: "group", name: "组", steps: [
    { delayMs: 0, annotation: "等界面加载", action: { type: "wait", ms: 1000 } },
  ] } }];
  assert.deepEqual(writeBlocks(parseBlocks(steps)), steps);
});
