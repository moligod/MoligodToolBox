import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePreset } from "../src/preset.ts";
import { defaultCrosshair } from "../src/crosshair-model.ts";

const preset = {
  schemaVersion: 3,
  kind: "moligod.crosshair",
  crosshair: { ...defaultCrosshair, color: "#C4F568" },
};
test("portable preset preserves parameters", () => {
  assert.deepEqual(parsePreset(JSON.stringify(preset)), {
    ...defaultCrosshair,
    ...preset.crosshair,
  });
});

test("all three hotkey modes are accepted and preserved", () => {
  for (const hotkeyMode of ["toggle", "hold", "holdShow"])
    assert.equal(
      parsePreset(
        JSON.stringify({
          ...preset,
          crosshair: { ...preset.crosshair, hotkeyMode },
        }),
      ).hotkeyMode,
      hotkeyMode,
    );
  assert.throws(() =>
    parsePreset(
      JSON.stringify({
        ...preset,
        crosshair: { ...preset.crosshair, hotkeyMode: "unknown" },
      }),
    ),
  );
});
test("reject incompatible and untrusted inputs before save", () => {
  const bad = [
    null,
    {},
    { ...preset, schemaVersion: 1 },
    { ...preset, schemaVersion: 4 },
    { ...preset, kind: "other" },
    ...[
      { size: -1 },
      { size: 24.5 },
      { gap: 21 },
      { thickness: 0 },
      { color: "red" },
      { color: "#12345g" },
      { style: "mixed" },
    ].map((change) => ({
      ...preset,
      crosshair: { ...preset.crosshair, ...change },
    })),
  ];
  for (const input of bad)
    assert.throws(() => parsePreset(JSON.stringify(input)));
  assert.throws(() => parsePreset("{broken"));
});

test("current format validates positions, image identifiers and hotkeys", () => {
  const preset = {
    schemaVersion: 3,
    kind: "moligod.crosshair",
    crosshair: { ...defaultCrosshair, style: "circle", offsetX: -120 },
  };
  assert.equal(parsePreset(JSON.stringify(preset)).offsetX, -120);
  for (const change of [
    { imageId: "../file" },
    { hotkey: 0 },
    { opacity: 0 },
    { offsetX: Infinity },
    { style: "other" },
  ]) {
    assert.throws(() =>
      parsePreset(
        JSON.stringify({
          ...preset,
          crosshair: { ...preset.crosshair, ...change },
        }),
      ),
    );
  }
});
