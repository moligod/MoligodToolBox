import { test } from "node:test";
import assert from "node:assert/strict";
import { workspaceTabs } from "../src/workspace-tabs.ts";

test("tool tabs stay open across home and settings navigation without duplication", () => {
  const tabs = workspaceTabs();
  tabs.select("crosshair");
  tabs.select("automation");
  tabs.select("crosshair");
  tabs.select("settings");
  tabs.select("tools");
  assert.deepEqual(tabs.opened(), ["crosshair", "automation"]);
  assert.equal(tabs.current(), "tools");
});

test("closing a background tab keeps the current tool; closing the final active tab returns home", () => {
  const tabs = workspaceTabs();
  tabs.select("crosshair");
  tabs.select("automation");
  assert.equal(tabs.close("crosshair"), true);
  assert.equal(tabs.current(), "automation");
  assert.equal(tabs.close("crosshair"), false);
  tabs.close("automation");
  assert.equal(tabs.current(), "tools");
  assert.deepEqual(tabs.opened(), []);
});

test("closing the active tab selects its remaining neighbour", () => {
  const tabs = workspaceTabs();
  tabs.select("crosshair");
  tabs.select("automation");
  tabs.close("automation");
  assert.equal(tabs.current(), "crosshair");
});
