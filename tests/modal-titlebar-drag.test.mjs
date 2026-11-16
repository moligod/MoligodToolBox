import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/modal-titlebar-drag.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
class Dialog {
  constructor(rect, modal = true) { this.rect = rect; this.modal = modal; }
  matches(selector) { return selector === ':modal' && this.modal; }
  getBoundingClientRect() { return this.rect; }
}
new Function('exports', 'HTMLDialogElement', js)(exports, Dialog);
const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
const element = (bounds) => ({ getBoundingClientRect: () => bounds });

test('only the exposed modal backdrop over the title bar starts a window drag', () => {
  let listener, drags = 0;
  const header = element(rect(0, 0, 1000, 60));
  const doc = { querySelector: () => header, addEventListener: (_, callback) => { listener = callback; } };
  exports.bindModalTitlebarDrag(doc, () => drags++);
  const dialog = new Dialog(rect(100, 100, 900, 700));
  const press = (target, x, y, button = 0) => {
    const event = { target, clientX: x, clientY: y, button, prevented: false, preventDefault() { this.prevented = true; } };
    listener(event);
    return event.prevented;
  };
  assert.equal(press(dialog, 300, 30), true);
  assert.equal(press(dialog, 750, 30), true);
  assert.equal(press(dialog, 900, 30), true);
  assert.equal(drags, 3);
  assert.equal(press(dialog, 300, 90), false);
  assert.equal(press(new Dialog(rect(100, 0, 500, 200)), 300, 30), false);
  assert.equal(press(dialog, 300, 30, 2), false);
  assert.equal(press(new Dialog(rect(100, 100, 900, 700), false), 300, 30), false);
  assert.equal(press({}, 300, 30), false);
  assert.equal(drags, 3);
});
