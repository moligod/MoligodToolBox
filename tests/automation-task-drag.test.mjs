import {test} from "node:test";
import assert from "node:assert/strict";
import {taskDrag} from "../src/automation-task-drag.ts";

function fixture(t) {
  const saved = {window:globalThis.window,document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  const frames = new Map();let serial=0;
  globalThis.window=new EventTarget();globalThis.document=new EventTarget();
  globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  t.after(()=>Object.assign(globalThis,saved));
  const classes = () => ({add(){},remove(){},toggle(){}});
  const rows=["","saved"].map((id,index)=>({dataset:{taskId:id},classList:classes(),getBoundingClientRect:()=>({top:index*80,bottom:index*80+80,height:80})}));
  const list={scrollTop:0,querySelectorAll:()=>rows,getBoundingClientRect:()=>({left:0,right:300,top:0,bottom:160})};
  const handle=new EventTarget();let captured=false;
  handle.setPointerCapture=()=>{captured=true;};handle.hasPointerCapture=()=>captured;handle.releasePointerCapture=()=>{captured=false;};
  const results=[];taskDrag(handle,rows[0],list,()=>true,target=>results.push(target));
  const fire=(type,y=20,x=20)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,pointerId:1,clientX:x,clientY:y});handle.dispatchEvent(e);return e;};
  return {fire,results,list,frames,tick(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}};
}
test("pointer handle sorts an unsaved task without native HTML drag events",t=>{
  const f=fixture(t);assert.equal(f.fire("pointerdown").defaultPrevented,true);
  f.fire("pointermove",140);f.fire("pointerup",140);
  assert.deepEqual(f.results,[{id:"saved",after:true}]);assert.equal(f.frames.size,0);
});
test("click, cancellation and horizontal outside drops do not reorder",t=>{
  const f=fixture(t);f.fire("pointerdown");f.fire("pointerup");
  f.fire("pointerdown");f.fire("pointermove",140);f.fire("pointercancel");
  f.fire("pointerdown");f.fire("pointermove",140,400);f.fire("pointerup",140,400);
  assert.deepEqual(f.results,[undefined,undefined,undefined]);assert.equal(f.frames.size,0);
});
test("stationary pointer near list edge continues scrolling until cancellation",t=>{
  const f=fixture(t);f.fire("pointerdown");f.fire("pointermove",150);
  f.tick();f.tick();assert.equal(f.list.scrollTop,12);
  window.dispatchEvent(new Event("blur"));assert.equal(f.frames.size,0);
  assert.deepEqual(f.results,[undefined]);
});
