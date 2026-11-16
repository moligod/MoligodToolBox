import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCrosshairCode,
  readCrosshairCode,
} from "../src/crosshair-code.ts";
import { defaultCrosshair } from "../src/crosshair-model.ts";
test("appearance code round-trips without replacing local controls", () => {
  const source = {
    ...defaultCrosshair,
    style: "circle",
    size: 40,
    color: "#12ABCD",
    offsetX: 50,
    hotkey: 65,
    monitor: "private-display",
  };
  const code = createCrosshairCode(source);
  assert.ok(code.startsWith("MG1."));
  assert.ok(code.length < 120);
  const result = readCrosshairCode(code, {
    ...defaultCrosshair,
    offsetX: 12,
    hotkey: 2,
  });
  assert.equal(result.style, "circle");
  assert.equal(result.size, 40);
  assert.equal(result.color, "#12ABCD");
  assert.equal(result.offsetX, 12);
  assert.equal(result.hotkey, 2);
  assert.equal(result.monitor, "");
});
test("invalid, changed and legacy codes are rejected", () => {
  const valid = createCrosshairCode(defaultCrosshair);
  for (const code of [
    "",
    "MOLI#old",
    "{}",
    valid.slice(0, -1),
    valid + "x",
    valid.replace("MG1", "MG2"),
    "x".repeat(1025),
  ])
    assert.throws(() => readCrosshairCode(code, defaultCrosshair));
});
test("custom images cannot generate crosshair codes", () => {
  const c = {
    ...defaultCrosshair,
    style: "image",
    imageId: "a".repeat(64),
    imageScale: 80,
  };
  assert.throws(() => createCrosshairCode(c), /自定义图片禁止生成准星码/);
  assert.throws(
    () => createCrosshairCode({ ...c, imageId: null }),
    /自定义图片禁止生成准星码/,
  );
});
