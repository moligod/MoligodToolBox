import { test } from "node:test";
import assert from "node:assert/strict";
import { startDragScroll } from "../src/automation-drag-scroll.ts";

function fixture(t) {
  const frames = new Map();
  let serial = 0;
  t.mock.method(globalThis, "requestAnimationFrame", (fn) => {
    frames.set(++serial, fn);
    return serial;
  });
  t.mock.method(globalThis, "cancelAnimationFrame", (id) => frames.delete(id));
  const bounds = { left: 100, right: 500, top: 100, bottom: 400, height: 300 };
  const root = {
    scrollTop: 500,
    scrollHeight: 2000,
    clientHeight: 300,
    isConnected: true,
    getBoundingClientRect: () => bounds,
  };
  const visited = [];
  let point = { x: 200, y: 400 };
  let now = 0;
  return {
    root,
    bounds,
    frames,
    visited,
    point: (value) => {
      point = value;
    },
    start: (callback) =>
      startDragScroll(
        root,
        () => point,
        callback ?? (() => visited.push(root.scrollTop)),
      ),
    tick(ms = 16) {
      now += ms;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((fn) => fn(now));
    },
  };
}

// Node has no display scheduler; replace only this API, not the scroll controller.
globalThis.requestAnimationFrame ??= () => {
  throw new Error("unmocked frame");
};
globalThis.cancelAnimationFrame ??= () => {};

test("holding a stationary drag at an edge scrolls on subsequent frames and refreshes drop targets", (t) => {
  const f = fixture(t);
  assert.equal(f.frames.size, 0);
  const stop = f.start();
  for (let i = 0; i < 20; i++) f.tick();
  assert.equal(f.visited.length, 20);
  assert.ok(f.root.scrollTop > 680);
  assert.ok(f.visited.every((value, i) => i === 0 || value > f.visited[i - 1]));
  stop();
  const position = f.root.scrollTop;
  f.tick();
  assert.equal(f.root.scrollTop, position);
  assert.equal(f.frames.size, 0);
});

test("moving to the middle or outside horizontally pauses scrolling, and the top reverses it", (t) => {
  const f = fixture(t);
  const stop = f.start();
  f.tick();
  const down = f.root.scrollTop;
  f.point({ x: 200, y: 250 });
  f.tick();
  assert.equal(f.root.scrollTop, down);
  f.point({ x: 600, y: 400 });
  f.tick();
  assert.equal(f.root.scrollTop, down);
  f.point({ x: 200, y: 100 });
  f.tick();
  assert.ok(f.root.scrollTop < down);
  stop();
});

test("scrolling clamps at both ends and resumes when the pointer reverses", (t) => {
  const f = fixture(t);
  f.root.scrollTop = 1699;
  const stop = f.start();
  f.tick();
  f.tick();
  assert.equal(f.root.scrollTop, 1700);
  assert.deepEqual(f.visited, [1700]);
  f.point({ x: 200, y: 100 });
  f.tick();
  assert.ok(f.root.scrollTop < 1700);
  f.root.scrollTop = 1;
  f.tick();
  f.tick();
  assert.equal(f.root.scrollTop, 0);
  stop();
});

test("frame timing avoids refresh-rate dependence and bounds a delayed frame", (t) => {
  const f = fixture(t);
  const stop = f.start();
  f.tick();
  const start = f.root.scrollTop;
  f.tick(8);
  f.tick(8);
  const fast = f.root.scrollTop - start;
  f.tick(16);
  assert.ok(Math.abs(f.root.scrollTop - start - fast * 2) < 0.001);
  const beforeDelay = f.root.scrollTop;
  f.tick(1000);
  assert.ok(f.root.scrollTop - beforeDelay < 20);
  stop();
});

test("cancellation during drop-target refresh leaves no pending frame", (t) => {
  const f = fixture(t);
  const stop = f.start(() => stop());
  f.tick();
  assert.equal(f.frames.size, 0);
});

test("lost drag state, hidden editor and detached editor terminate the frame loop", (t) => {
  for (const invalidate of [
    (f) => f.point(undefined),
    (f) => {
      f.bounds.height = 0;
    },
    (f) => {
      f.root.isConnected = false;
    },
  ]) {
    const f = fixture(t);
    f.start();
    invalidate(f);
    f.tick();
    assert.equal(f.root.scrollTop, 500);
    assert.equal(f.frames.size, 0);
  }
});
