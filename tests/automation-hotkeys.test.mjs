import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultStopHotkey, readStopHotkey, stopHotkeyLabel } from "../src/automation-hotkeys.ts";
const event = (code, modifiers = {}) => ({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers });
test("emergency hotkey records combinations and preserves the legacy default", () => {
  assert.equal(stopHotkeyLabel(defaultStopHotkey), "Ctrl + Alt + F10");
  assert.deepEqual(readStopHotkey(event("F8", { ctrlKey: true, shiftKey: true })), { schemaVersion: 1, modifiers: 6, key: 119 });
  assert.equal(stopHotkeyLabel(readStopHotkey(event("KeyK", { ctrlKey: true, altKey: true }))), "Ctrl + Alt + K");
  assert.equal(readStopHotkey(event("F24")).key, 135);
  assert.equal(readStopHotkey(event("ControlLeft")), null);
});
test("emergency hotkey refuses reserved and accidental text keys", () => {
  for (const e of [event("F12"), event("KeyA"), event("KeyA", {shiftKey:true}), event("F8", {metaKey:true}), event("Unidentified"), event("Delete", {ctrlKey:true,altKey:true})])
    assert.throws(() => readStopHotkey(e));
});
