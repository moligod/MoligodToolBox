import {test} from "node:test";
import assert from "node:assert/strict";
import "blockly/core";
import {registerHooks} from "node:module";
const core = new URL("./blockly.mjs",import.meta.resolve("blockly/core")).href;
const hooks = registerHooks({resolve(specifier,context,next) {
  return specifier === "blockly/core" ? {url:core,shortCircuit:true} : next(specifier,context);
}});
const {installFlyoutPickup} = await import("../src/automation-blockly-pickup.ts");
hooks.deregister();

function fixture(t, dockRight = 0, dockBottom = 600) {
  const oldDocument=globalThis.document, oldElement=globalThis.Element;
  class Element {closest(selector){return selector === '.blocklyFlyout' && this.palette ? {getBoundingClientRect:()=>({left:100,right:300,top:0,bottom:600})} : null;}}
  const source=new Element(); source.palette=true;
  const doc=new EventTarget(); globalThis.document=doc; globalThis.Element=Element;
  const calls=[], classes=new Set();
  const host={classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},
    closest:()=>dockRight ? {querySelector:()=>({getBoundingClientRect:()=>({left:100,top:0,right:dockRight,bottom:dockBottom})})} : null,
    querySelector:()=>({getBoundingClientRect:()=>({left:100,right:1000,top:0,bottom:600})}),
    querySelectorAll:()=>[{getClientRects:()=>[1],getBoundingClientRect:()=>({left:100,right:300,top:0,bottom:600})}]};
  let dragging=false, readOnly=false, moves=0, scrollStops=0;
  const gesture={isDragging:()=>dragging,handleMove:()=>{moves++;dragging=true;},
    dispose:()=>calls.push("dispose"),getCurrentDragger:()=>dragging?{onDragRevert:()=>calls.push("revert"),stopAutoScrolling:()=>scrollStops++}:null};
  const workspace={isReadOnly:()=>readOnly,getGesture:()=>gesture,
    getFlyout:()=>({getWorkspace:()=>({getTopBlocks:()=>[{isMovable:()=>true,getSvgRoot:()=>({contains:node=>node===source})}]})})};
  const pickup=installFlyoutPickup(host,workspace);
  t.after(()=>{pickup.dispose();globalThis.document=oldDocument;globalThis.Element=oldElement;});
  const fire=(type,x=150,y=20,extra={})=>{
    const event=new Event(type,{cancelable:true});
    Object.defineProperties(event,Object.fromEntries(Object.entries({target:source,pointerId:1,pointerType:"mouse",buttons:1,button:0,clientX:x,clientY:y,...extra}).map(([key,value])=>[key,{value}])));
    doc.dispatchEvent(event);return event;
  };
  return {pickup,fire,calls,classes,getMoves:()=>moves,getScrollStops:()=>scrollStops,setDragging:value=>{dragging=value;},setReadOnly:value=>{readOnly=value;}};
}
test("a click releases the palette item and later pointer movement does not pick it up",t=>{
  const f=fixture(t);
  f.fire("pointerdown");
  assert.equal(f.fire("pointerup").defaultPrevented,false);
  assert.equal(f.pickup.active(),false);
  assert.equal(f.fire("pointermove",200,20,{buttons:0}).defaultPrevented,false);
  assert.equal(f.getMoves(),0);
  assert.deepEqual(f.calls,[]);
});

test("dragging within the palette follows the pointer and releases without committing",t=>{
  const f=fixture(t);
  f.fire("pointerdown");
  assert.equal(f.fire("pointermove",200).defaultPrevented,true);
  assert.equal(f.fire("pointerup",200).defaultPrevented,true);
  assert.equal(f.pickup.active(),false);
  assert.deepEqual(f.calls,["dispose","revert"]);
});
test("Escape and dropping outside the canvas cancel without committing the gesture",t=>{
  const f=fixture(t);
  f.fire("pointerdown");
  assert.equal(f.fire("keydown",150,20,{key:"Escape"}).defaultPrevented,true);
  assert.equal(f.pickup.active(),false);
  assert.deepEqual(f.calls,["dispose"]);
  f.calls.length=0;f.fire("pointerdown");f.setDragging(true);
  assert.equal(f.fire("pointerup",40,300).defaultPrevented,true);
  assert.deepEqual(f.calls,["dispose","revert"]);
  assert.equal(f.pickup.active(),false);
});
test("ordinary dragging still commits and read-only workspaces cannot pick up templates",t=>{
  const f=fixture(t);
  f.fire("pointerdown");f.setDragging(true);
  assert.equal(f.fire("pointerup",500).defaultPrevented,false);
  assert.equal(f.pickup.active(),false);
  f.setReadOnly(true);f.fire("pointerdown");
  assert.equal(f.pickup.active(),false);
});

test("placing over the docked task panel cancels instead of hiding a new block behind it",t=>{
  const f=fixture(t,400);
  f.fire("pointerdown");f.setDragging(true);
  assert.equal(f.fire("pointerup",350,20).defaultPrevented,true);
  assert.deepEqual(f.calls,["dispose","revert"]);
  assert.equal(f.pickup.active(),false);
});

test("a full-width toolbar does not reject drops onto the canvas below it",t=>{
  const f=fixture(t,1000,60);
  f.fire("pointerdown");f.setDragging(true);
  assert.equal(f.fire("pointerup",500,200).defaultPrevented,false);
  assert.equal(f.pickup.active(),false);
  assert.deepEqual(f.calls,[]);
});
