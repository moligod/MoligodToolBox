import { test } from "node:test";
import assert from "node:assert/strict";
import { stepSummary, formatKeys } from "../src/automation-step-summary.ts";

test("readable steps preserve millisecond values and include the target and pre-delay", () => {
  const step = { delayMs: 250, action: { type: "wait", ms: 1500 } };
  const original = structuredClone(step);
  assert.equal(stepSummary(step, {}), "等待 1.75 秒");
  assert.deepEqual(step, original);
  assert.equal(
    stepSummary(
      {
        delayMs: 0,
        action: { type: "click", target: "C", x: 23, y: 42, button: "right" },
      },
      {},
    ),
    "在窗口 3（23, 42）点击右键",
  );
});
test("keyboard summaries distinguish arrows, function keys and unknown native key codes", () => {
  assert.equal(formatKeys([17, 65]), "Ctrl + A");
  assert.equal(formatKeys([37, 119, 255]), "← + F8 + VK 255");
  assert.equal(
    stepSummary(
      { delayMs: 0, action: { type: "key", target: "B", keys: [32] } },
      {},
    ),
    "在窗口 2按 空格",
  );
});

test("direct software targets show the window title instead of an alias", () => {
  assert.equal(stepSummary({delayMs:0, action:{type:"focus",target:"window:QQ"}},{}),"切换到 QQ");
});
