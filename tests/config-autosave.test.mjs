import { test } from "node:test";
import assert from "node:assert/strict";
import { configAutosave } from "../src/config-autosave.ts";
import { defaultCrosshair } from "../src/crosshair-model.ts";

const initial = {
  schemaVersion: 3,
  closeToTray: false,
  crosshair: { ...defaultCrosshair },
};

test("saves edits without starting a tool and keeps the newest settings during an in-flight write", async () => {
  const written = [];
  let release;
  const settings = configAutosave(async (value) => {
    written.push(value);
    if (written.length === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    // An old native reply must never replace the newer in-memory configuration.
    return value;
  }, assert.fail);
  assert.equal(settings.update({ closeToTray: true }), false);
  settings.initialize(initial);
  assert.deepEqual(written, []);
  settings.update({ crosshair: { ...defaultCrosshair, size: 32 } });
  settings.update({ closeToTray: true });
  settings.update({
    crosshair: {
      ...settings.current().crosshair,
      size: 48,
      hotkeyMode: "holdShow",
      hotkey: 5,
    },
  });
  assert.equal(written.length, 1);
  assert.equal(settings.current().crosshair.size, 48);
  release();
  await settings.idle();
  assert.equal(written.length, 2);
  assert.deepEqual(written[1], settings.current());
  assert.equal(written[1].closeToTray, true);
  assert.equal(written[1].crosshair.hotkeyMode, "holdShow");
});

test("reports a failed save, preserves the draft, and allows subsequent changes to save", async () => {
  const errors = [];
  let attempts = 0;
  const settings = configAutosave(
    async () => {
      if (++attempts === 1) throw new Error("disk unavailable");
    },
    (error) => errors.push(error.message),
  );
  settings.initialize(initial);
  settings.update({ crosshair: { ...defaultCrosshair, offsetX: 20 } });
  await settings.idle();
  assert.deepEqual(errors, ["disk unavailable"]);
  assert.equal(settings.current().crosshair.offsetX, 20);
  settings.update({ closeToTray: true });
  await settings.idle();
  assert.equal(attempts, 2);
  assert.equal(settings.current().crosshair.offsetX, 20);
});
