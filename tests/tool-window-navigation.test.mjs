import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync(new URL('../src/navigation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
test('launcher opens each tool in its own window without expanding or activating local editors', () => {
  const opened = [];
  const api = { toolWindowPage: undefined, openToolWindow: async page => { opened.push(page); }, setToolboxExpanded: () => { throw new Error('launcher expanded'); } };
  const exports = {};
  new Function('exports', 'require', 'document', js)(exports, name => name.includes('workspace-tabs') ? { workspaceTabs: () => ({}) } : api, { getElementById: () => { throw new Error('local page activated'); } });
  exports.showPage('crosshair');
  exports.showPage('automation');
  assert.deepEqual(opened, ['crosshair', 'automation']);
});
test('hiding a tool window closes its page once so idle native modules are released', () => {
  const events = [];
  const page = { hidden: false, dispatchEvent: event => events.push(event.type) };
  const api = { toolWindowPage: 'automation', openToolWindow: async () => {}, setToolboxExpanded: async () => {} };
  const exports = {};
  new Function('exports', 'require', 'document', js)(exports, name => name.includes('workspace-tabs') ? { workspaceTabs: () => ({}) } : api, { getElementById: id => id === 'automation-dialog' ? page : null });
  exports.setToolPageVisible('automation', true);
  assert.deepEqual(events, [], 'showing an already visible page must not reactivate it');
  exports.setToolPageVisible('automation', false);
  exports.setToolPageVisible('automation', false);
  assert.equal(page.hidden, true);
  assert.deepEqual(events, ['close']);
});
