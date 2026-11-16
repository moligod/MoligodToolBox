import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(new URL("../src/automation-warning-dismissal.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const exported = {};
const blockly = { Events: { BUBBLE_OPEN: "bubble_open", BLOCK_DELETE: "delete" }, icons: { WarningIcon: { TYPE: "warning" } } };
new Function("exports", "require", source)(exported, () => blockly);

function fixture(t) {
  const dom = new JSDOM("<body></body>");
  const listeners = new Set(), warnings = new Map(), hidden = [], errors = [];
  const emit = event => { for (const listener of [...listeners]) listener(event); };
  const workspace = {
    addChangeListener: listener => listeners.add(listener),
    removeChangeListener: listener => listeners.delete(listener),
    getBlockById: id => ({ getIcon: () => warnings.get(id)?.icon }),
  };
  const dispose = exported.installWarningDismissal(workspace, text => errors.push(text));
  t.after(() => { dispose(); dom.window.close(); });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const open = (id = "first", hovered = false) => {
    const root = dom.window.document.createElementNS("http://www.w3.org/2000/svg", "g");
    const state = { root, hovered, visible: true };
    root.matches = selector => selector === ":hover" && state.hovered;
    state.icon = {
      getBubble: () => state.visible ? { getSvgRoot: () => root } : null,
      async setBubbleVisible(visible) {
        state.visible = visible;
        hidden.push(id);
        root.remove();
        emit({ type: "bubble_open", blockId: id, bubbleType: "warning", isOpen: visible });
      },
    };
    dom.window.document.body.append(root);
    warnings.set(id, state);
    emit({ type: "bubble_open", blockId: id, bubbleType: "warning", isOpen: true });
    return state;
  };
  const hover = (state, inside) => {
    state.hovered = inside;
    state.root.dispatchEvent(new dom.window.Event(inside ? "pointerenter" : "pointerleave"));
  };
  return { open, hover, emit, hidden, errors, dispose, listeners, tick: ms => t.mock.timers.tick(ms) };
}

test("warnings opened outside the pointer close after exactly three seconds", t => {
  const view = fixture(t);
  const warning = view.open();
  view.tick(2999);
  assert.equal(warning.visible, true);
  view.tick(1);
  assert.equal(warning.visible, false);
  assert.deepEqual(view.hidden, ["first"]);
});

test("pointer entry cancels dismissal and leaving restarts a full three seconds", t => {
  const view = fixture(t);
  const warning = view.open("first", true);
  view.tick(5000);
  assert.equal(warning.visible, true);
  view.hover(warning, false);
  view.tick(2500);
  view.hover(warning, true);
  view.tick(5000);
  assert.equal(warning.visible, true);
  view.hover(warning, false);
  view.tick(2999);
  assert.equal(warning.visible, true);
  view.tick(1);
  assert.equal(warning.visible, false);
});

test("each open warning has its own timer and reopening discards the old timer", t => {
  const view = fixture(t);
  const first = view.open("first", true);
  view.open("second");
  view.tick(3000);
  assert.deepEqual(view.hidden, ["second"]);
  view.hover(first, false);
  view.tick(1000);
  first.root.remove();
  const reopened = view.open("first");
  view.tick(2000);
  assert.equal(reopened.visible, true);
  view.tick(1000);
  assert.deepEqual(view.hidden, ["second", "first"]);
});

test("manual close, block deletion, detached bubbles, and disposal release dismissal work", t => {
  const view = fixture(t);
  view.open("closed");
  view.emit({ type: "bubble_open", blockId: "closed", bubbleType: "warning", isOpen: false });
  view.open("deleted");
  view.emit({ type: "delete", ids: ["deleted"] });
  view.open("detached").root.remove();
  view.tick(3000);
  assert.deepEqual(view.hidden, []);
  const warning = view.open("disposed");
  view.dispose();
  assert.equal(view.listeners.size, 0);
  view.tick(3000);
  assert.equal(warning.visible, true);
  assert.deepEqual(view.hidden, []);
});
