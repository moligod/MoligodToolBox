import {test} from "node:test";
import assert from "node:assert/strict";
import {RecycleHistory,recycledState} from "../src/automation-recycle-history.ts";

test("recycle history keeps the latest thirty deletions including identical actions",()=>{
  const history=new RecycleHistory();
  const state={type:"moligod_action",extraState:{step:{delayMs:0,action:{type:"wait",ms:1000}}}};
  for(let i=0;i<35;i++) history.add(state,[String(i)]);
  assert.equal(history.entries.length,30);
  assert.equal(history.entries[0].ids[0],"34");
  assert.equal(history.entries.at(-1).ids[0],"5");
  state.extraState.step.action.ms=9000;
  assert.equal(history.entries[0].state.extraState.step.action.ms,1000);
});

test("restoring a deletion removes only that entry; undo restores complete original identities",()=>{
  const history=new RecycleHistory(),state={type:"moligod_action"};
  history.add(state,["parent","child"]);
  history.add(state,["other"]);
  history.restored(["parent"]);
  assert.equal(history.entries.length,2);
  history.restored(["parent","child"]);
  assert.deepEqual(history.entries.map(entry=>entry.ids),[["other"]]);
  history.remove(history.entries[0].key);
  assert.equal(history.entries.length,0);
});

test("restoration refreshes all block identities but preserves nested action data and legacy fields",()=>{
  const step={delayMs:51,randomDelayMs:7,annotation:"old note",action:{type:"set",variable:"x",value:{id:"user value",x:10}}};
  const state={type:"moligod_action",id:"group",x:100,y:50,extraState:{step},
    inputs:{BODY_0:{block:{type:"moligod_action",id:"child",extraState:{step}},shadow:{type:"shadow",id:"shadow"}}},
    next:{block:{type:"moligod_action",id:"next",extraState:{step}}}};
  const before=structuredClone(state),restored=recycledState(state);
  assert.deepEqual(state,before);
  assert.equal(restored.id,undefined);
  assert.equal(restored.x,undefined);
  assert.equal(restored.inputs.BODY_0.block.id,undefined);
  assert.equal(restored.inputs.BODY_0.shadow.id,undefined);
  assert.equal(restored.next.block.id,undefined);
  assert.deepEqual(restored.inputs.BODY_0.block.extraState.step,step);
  assert.equal(restored.extraState.step.action.value.id,"user value");
});
