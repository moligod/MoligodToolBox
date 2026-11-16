import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync(new URL('../src/toolbox-shell.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const calls = [], failures = [];
  const element = () => ({ handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; } });
  const header = { ...element(), setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} };
  const root = element();
  let compact = true;
  const doc = { getElementById: () => element(), querySelector: () => header, documentElement: root,
    body: { classList: { contains: () => compact } } };
  const api = { desktop: true, onToolboxWindowError: async () => () => {}, toolboxDrag: async phase => { calls.push(phase); return phase === 'end'; }, toolboxDock: async collapse => { calls.push(collapse ? 'hide' : 'show'); return collapse; } };
  const exports = {};
  new Function('exports', 'require', 'document', js)(exports, () => api, doc);
  exports.initToolboxShell(error => failures.push(error));
  const event = (interactive = false) => ({ button: 0, pointerId: 1, target: { closest: () => interactive },
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } });
  return { calls, failures, header, root, event, expand: () => { compact = false; } };
}
test('compact titlebar bypasses native snap and ends drag on release even without mouseleave', async () => {
  const f = fixture(), e = f.event();
  f.header.handlers.pointerdown(e);
  f.header.handlers.pointermove(e);
  f.header.handlers.pointerup(e);
  await flush();
  assert.equal(e.prevented, true);
  assert.equal(e.stopped, true);
  assert.deepEqual(f.calls, ['start', 'move', 'end']);
  assert.deepEqual(f.failures, []);
});
test('expanded titlebar and controls retain normal interactions', async () => {
  const f = fixture(), control = f.event(true);
  f.header.handlers.pointerdown(control);
  f.expand();
  const expanded = f.event();
  f.header.handlers.pointerdown(expanded);
  await flush();
  assert.equal(control.prevented, undefined);
  assert.equal(expanded.prevented, undefined);
  assert.deepEqual(f.calls, []);
});
test('capture loss cancels drag and animation-generated enter does not immediately reopen', async () => {
  const f = fixture(), e = f.event();
  f.header.handlers.pointerdown(e);
  f.header.handlers.lostpointercapture(e);
  f.root.handlers.mouseenter();
  await flush();
  assert.deepEqual(f.calls, ['start', 'cancel']);
  f.root.handlers.mouseenter();
  await flush();
  assert.deepEqual(f.calls, ['start', 'cancel', 'show']);
});
