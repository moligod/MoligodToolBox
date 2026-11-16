import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionSelection } from '../src/automation-blockly-selection.ts';
import { dragAdjustment } from '../src/automation-blockly-multidrag.ts';

test('plain, Ctrl and Shift selection follows nested action order in either direction', () => {
  const selection = new ActionSelection();
  const order = ['first', 'click', 'if', 'child1', 'child2', 'last'];
  selection.click('first', order, false, false);
  selection.click('last', order, true, false);
  assert.deepEqual([...selection.ids], order);
  selection.selectForContext('child1', order);
  assert.deepEqual([...selection.ids], order);
  selection.click('child1', order, false, true);
  assert.deepEqual([...selection.ids], ['first', 'click', 'if', 'child2', 'last']);
  selection.click('child1', order, false, true);
  assert.equal(selection.ids.has('child1'), true);
  selection.click('last', order, false, false);
  selection.click('click', order, true, false);
  assert.deepEqual([...selection.ids], ['click', 'if', 'child1', 'child2', 'last']);
  selection.click('other', ['other'], true, false);
  assert.deepEqual([...selection.ids], ['other']);
  selection.selectForContext('click', order);
  assert.deepEqual([...selection.ids], ['click']);
  selection.clear();
  assert.equal(selection.ids.size, 0);
  assert.equal(selection.anchor, undefined);
});

test('dragging a later nonadjacent selection keeps the grabbed block under the pointer', () => {
  const head = {id:'a', getRelativeToSurfaceXY:()=>({x:0,y:0}), getSurroundParent:()=>null, nextConnection:{getOffsetInBlock:()=>({x:0,y:40})}};
  const last = {id:'b', getRelativeToSurfaceXY:()=>({x:0,y:200}), getSurroundParent:()=>null, previousConnection:{getOffsetInBlock:()=>({x:0,y:0})}};
  assert.deepEqual(dragAdjustment({scale:0.5},[head,last],last),{x:0,y:80});
  const child = {id:'child', getSurroundParent:()=>last};
  assert.deepEqual(dragAdjustment({scale:0.5},[head,last],child),{x:0,y:80});
  assert.deepEqual(dragAdjustment({scale:0.5},[head,last],head),{x:0,y:0});
  const many = Array.from({length:14},(_,i)=>({id:String(i),getRelativeToSurfaceXY:()=>({x:0,y:i*50}),getSurroundParent:()=>null,previousConnection:{getOffsetInBlock:()=>({x:0,y:0})},nextConnection:{getOffsetInBlock:()=>({x:0,y:40})}}));
  assert.deepEqual(dragAdjustment({scale:0.5},many,many[13]),{x:0,y:65});
});
