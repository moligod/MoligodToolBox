import { test } from "node:test";
import assert from "node:assert/strict";
import { draggedOffset } from "../src/offset-drag.ts";
test("stationary hold does not change value; movement follows the drag axis", () => {
  assert.equal(draggedOffset(20, 100, 100, -16384, 16384), 20);
  assert.equal(draggedOffset(20, 100, 130, -16384, 16384), 50);
  assert.equal(draggedOffset(20, 100, 85, -16384, 16384), 5);
  assert.equal(draggedOffset(20, 100, 100, -16384, 16384), 20);
});
test("drag clamps to allowed range and recovers immediately on reversal", () => {
  assert.equal(draggedOffset(16380, 0, 100, -16384, 16384), 16384);
  assert.equal(draggedOffset(16380, 0, -10, -16384, 16384), 16370);
  assert.equal(draggedOffset(-16380, 0, -100, -16384, 16384), -16384);
  assert.equal(draggedOffset(NaN, 10, 14, -16384, 16384), 4);
});
