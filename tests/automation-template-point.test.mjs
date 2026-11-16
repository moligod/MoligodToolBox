import { test } from "node:test";
import assert from "node:assert/strict";
import { templateImagePoint } from "../src/automation-template-point.ts";
import { requiredScriptVersion } from "../src/automation-action-draft.ts";
import { scaleAction } from "../src/automation-scale.ts";

test("template picking uses source pixels including edges and scaled previews", () => {
  assert.deepEqual(templateImagePoint(25, 10, 50, 25, 100, 50), {
    x: 50,
    y: 20,
  });
  assert.deepEqual(templateImagePoint(50, 25, 50, 25, 100, 50), {
    x: 99,
    y: 49,
  });
  assert.deepEqual(templateImagePoint(-2, -2, 50, 25, 100, 50), { x: 0, y: 0 });
});
test("template points require the new script version and retain template pixels across DPI changes", () => {
  const step = {
    delayMs: 0,
    action: {
      type: "match",
      region: { x: 10, y: 20, width: 100, height: 100 },
      templatePoint: { x: 3, y: 5 },
    },
  };
  assert.equal(requiredScriptVersion([step]), 4);
  assert.equal(
    requiredScriptVersion([
      step,
      { delayMs: 0, action: { type: "ocr", numericResult: true } },
    ]),
    4,
  );
  scaleAction(step.action, 1.5);
  assert.deepEqual(step.action.templatePoint, { x: 3, y: 5 });
  assert.equal(step.action.region.x, 15);
});
