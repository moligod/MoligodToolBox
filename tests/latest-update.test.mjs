import { test } from "node:test";
import assert from "node:assert/strict";
import { latestUpdate } from "../src/latest-update.ts";

test("rapid changes keep only newest pending value, with one request in flight", async () => {
  const sent = [];
  let release;
  const queue = latestUpdate(
    async (value) => {
      sent.push(value);
      if (value === 1)
        await new Promise((resolve) => {
          release = resolve;
        });
    },
    (error) => {
      throw error;
    },
  );
  queue.resume();
  queue.push(1);
  queue.push(2);
  queue.push(3);
  assert.deepEqual(sent, [1]);
  release();
  await queue.idle();
  assert.deepEqual(sent, [1, 3]);
});
test("stop barrier finishes in-flight update and clears pending changes", async () => {
  const sent = [];
  let release;
  const queue = latestUpdate(
    async (value) => {
      sent.push(value);
      await new Promise((resolve) => {
        release = resolve;
      });
    },
    (error) => {
      throw error;
    },
  );
  queue.resume();
  queue.push(1);
  queue.push(2);
  const paused = queue.pause();
  queue.clear();
  release();
  await paused;
  queue.resume();
  await queue.idle();
  assert.deepEqual(sent, [1]);
});
test("failed update does not prevent later changes", async () => {
  const errors = [];
  const sent = [];
  const queue = latestUpdate(
    async (value) => {
      if (value === 1) throw new Error("invalid");
      sent.push(value);
    },
    (error) => errors.push(error),
  );
  queue.resume();
  queue.push(1);
  queue.push(2);
  await queue.idle();
  assert.equal(errors.length, 1);
  assert.deepEqual(sent, [2]);
});
