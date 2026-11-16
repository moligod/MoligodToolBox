import { test } from "node:test";
import assert from "node:assert/strict";
import { virtualKey, keyLabel, mouseKey } from "../src/hotkey-capture.ts";
test("records letters, function keys, arrows, modifiers, keypad and punctuation", () => {
  for (const [code, vk] of [
    ["KeyA", 65],
    ["F8", 119],
    ["F24", 135],
    ["Space", 32],
    ["ArrowUp", 38],
    ["ControlRight", 17],
    ["ShiftLeft", 16],
    ["Numpad3", 99],
    ["BracketLeft", 219],
    ["Escape", 27],
  ])
    assert.equal(virtualKey(code), vk);
  assert.equal(keyLabel(119), "F8");
  assert.equal(keyLabel(65), "A");
  assert.equal(virtualKey("Unidentified"), null);
  assert.equal(virtualKey("F25"), null);
});
test("mouse recording supports left right middle and both side buttons", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(mouseKey), [1, 4, 2, 5, 6]);
  assert.equal(keyLabel(mouseKey(2)), "鼠标右键");
  assert.equal(mouseKey(5), null);
});
