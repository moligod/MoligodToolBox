import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Exercise the actual registered handler, including a bubbled file-input cancel.
const source = readFileSync(new URL("../src/automation-editor.ts", import.meta.url), "utf8");
const tree = ts.createSourceFile("editor.ts", source, ts.ScriptTarget.Latest, true);
let callback;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "settingsDialog.addEventListener" && node.arguments[0]?.text === "cancel") callback = node.arguments[1].getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(callback, "settings dialog must have a cancel handler");
const handlerFactory = new Function("settingsDialog", "finishSetup", `return (${callback});`);

test("cancelling a template file chooser preserves the parent settings dialog", () => {
  const settingsDialog = new EventTarget();
  const fileInput = new EventTarget();
  let closed = 0;
  const handler = handlerFactory(settingsDialog, () => closed++);
  // The browser bubbles this input cancel to its ancestor dialog.
  fileInput.addEventListener("cancel", handler);
  const cancelled = new Event("cancel", {bubbles:true,cancelable:true});
  fileInput.dispatchEvent(cancelled);
  assert.equal(closed, 0);
  assert.equal(cancelled.defaultPrevented, false);
});
test("Escape cancellation of the settings dialog still closes it normally", () => {
  const settingsDialog = new EventTarget();
  let closed = 0;
  settingsDialog.addEventListener("cancel", handlerFactory(settingsDialog, () => closed++));
  const cancelled = new Event("cancel", {cancelable:true});
  settingsDialog.dispatchEvent(cancelled);
  assert.equal(closed, 1);
  assert.equal(cancelled.defaultPrevented, true);
});
