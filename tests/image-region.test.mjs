import { test } from "node:test";
import assert from "node:assert/strict";
import { imagePoint, imageRegion } from "../src/image-region.ts";
test("scaled screenshot selection maps both corners to native pixels", () => {
  const a = imagePoint(50, 25, 400, 200, 1600, 800),
    b = imagePoint(150, 75, 400, 200, 1600, 800);
  assert.deepEqual(imageRegion(a, b), {
    x: 200,
    y: 100,
    width: 400,
    height: 200,
  });
  assert.deepEqual(imageRegion(b, a), imageRegion(a, b));
});
test("selection clamps to image boundaries and rejects zero area", () => {
  assert.deepEqual(imagePoint(-5, 999, 400, 200, 1600, 800), { x: 0, y: 800 });
  assert.equal(imageRegion({ x: 2, y: 3 }, { x: 2, y: 30 }), null);
  assert.deepEqual(imageRegion({ x: 0, y: 0 }, { x: 1600, y: 800 }), {
    x: 0,
    y: 0,
    width: 1600,
    height: 800,
  });
});
