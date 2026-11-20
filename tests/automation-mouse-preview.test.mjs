import { test } from "node:test";
import assert from "node:assert/strict";
import { mousePoint, applyMousePoints } from "../src/automation-mouse-preview.ts";
test("inline screenshot maps scaled coordinates and clamps captured pointer outside image", () => {
  const rect = {left:100,top:50,width:450,height:300};
  assert.deepEqual(mousePoint(325,200,rect,1800,1200), {x:900,y:600});
  assert.deepEqual(mousePoint(90,20,rect,1800,1200), {x:0,y:0});
  assert.deepEqual(mousePoint(900,900,rect,1800,1200), {x:1799,y:1199});
});
test("region drags past the bottom-right corner include the last column and row", () => {
  const rect = {left:0,top:0,width:960,height:540};
  const start = mousePoint(-5,-5,rect,3840,2160,true), end = mousePoint(2000,2000,rect,3840,2160,true);
  assert.deepEqual([start,end], [{x:0,y:0},{x:3840,y:2160}]);
  for (const type of ["ocr","match","capture"]) {
    const step={action:{type}};
    applyMousePoints(step,start,end);
    assert.deepEqual(step.action.region,{x:0,y:0,width:3840,height:2160});
  }
  // Points that name a pixel (click, drag, scroll) still stop at the last pixel index.
  assert.deepEqual(mousePoint(2000,2000,rect,3840,2160), {x:3839,y:2159});
});
test("reverse drag preserves direction while click and scroll select only the final point", () => {
  const start={x:90,y:80},end={x:10,y:20};
  const drag={delayMs:0, annotation:"keep",action:{type:"drag",target:"A",button:"right",durationMs:300}};
  applyMousePoints(drag,start,end);
  assert.deepEqual(drag.action,{type:"drag",target:"A",button:"right",durationMs:300,fromX:90,fromY:80,toX:10,toY:20});
  assert.equal(drag.annotation,"keep");
  for (const type of ["click","scroll"]) {
    const step={delayMs:0,action:{type,target:"B"}};
    applyMousePoints(step,start,end);
    assert.deepEqual(step.action,{type,target:"B",x:10,y:20});
  }
});

test("operation changes reuse the screenshot, including while capture is pending", async () => {
  const { createMousePreview } = await import("../src/automation-mouse-preview.ts");
  const oldDocument=globalThis.document, oldImage=globalThis.Image;
  const ctx={drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},strokeRect(){},fillText(){}};
  const element=()=>({children:[],listeners:{},append(...items){this.children.push(...items)},insertBefore(item){this.children.push(item)},querySelector(){return null},setAttribute(){},addEventListener(type,fn){this.listeners[type]=fn},getContext(){return ctx}});
  globalThis.document={createElement:element};
  globalThis.Image=class {naturalWidth=450;naturalHeight=300;async decode(){}};
  try {
    const parent=element();
    const step={delayMs:0,action:{type:"click",x:10,y:20}};
    let captures=0,finish;
    const preview=createMousePreview(parent,{owner:()=>step,locked:()=>false,update(){},capture:()=>{captures++;return new Promise(resolve=>{finish=resolve})}});
    const loading=preview.load();
    step.action={type:"drag",fromX:10,fromY:20,toX:30,toY:40};
    preview.updateMode();
    assert.equal(captures,1);
    finish({width:900,height:600,png:"mock"});
    await loading;
    const [refresh,hint,canvas]=parent.children[0].children;
    assert.equal(hint.textContent, "");
    assert.equal(hint.hidden, true);
    assert.equal(canvas.hidden,false);
    step.action={type:"scroll",x:10,y:20};
    preview.updateMode();
    assert.equal(captures,1);
    assert.equal(hint.textContent, "");
    assert.equal(hint.hidden, true);
    step.action={type:"ocr",region:{x:10,y:20,width:30,height:40}};
    preview.updateMode();
    canvas.getBoundingClientRect=()=>({left:0,top:0,width:900,height:600});
    canvas.setPointerCapture=()=>{};
    const gesture=(x,y,toX,toY)=>{
      canvas.listeners.pointerdown({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){}});
      canvas.listeners.pointerup({pointerId:1,clientX:toX,clientY:toY});
    };
    gesture(10,20,110,120);
    assert.deepEqual(step.action.region,{x:10,y:20,width:100,height:100});
    gesture(200,210,300,310);
    assert.deepEqual(step.action.region,{x:200,y:210,width:100,height:100});
    gesture(400,410,500,510);
    assert.deepEqual(step.action.region,{x:400,y:410,width:100,height:100});
    assert.equal(captures,1);
    refresh.listeners.click();
    assert.equal(captures,2);
    preview.reset();
    finish({width:900,height:600,png:"stale"});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(canvas.hidden,true);
  } finally {globalThis.document=oldDocument;globalThis.Image=oldImage;}
});

test("preview layout rescaling keeps the same source pixel without using devicePixelRatio", () => {
  for (const scale of [1, 1.25, 1.5, 2]) {
    const rect = {left:60, top:40, width:800/scale, height:600/scale};
    assert.deepEqual(mousePoint(rect.left+rect.width/4,rect.top+rect.height/2,rect,1600,1200),{x:400,y:600});
  }
});

test("OCR testing remains tied to the displayed full-resolution frame across scale changes", async () => {
  const { createMousePreview } = await import("../src/automation-mouse-preview.ts");
  const oldDocument=globalThis.document, oldImage=globalThis.Image;
  const ctx={drawImage(){},strokeRect(){}};
  const element=()=>({children:[],append(...items){this.children.push(...items)},insertBefore(item){this.children.push(item)},querySelector(){return null},setAttribute(){},addEventListener(){},getContext(){return ctx}});
  globalThis.document={createElement:element};
  globalThis.Image=class {naturalWidth=640;naturalHeight=240;async decode(){}};
  try {
    const step={delayMs:0,action:{type:"ocr",region:{x:300,y:150,width:100,height:50}}};
    let scale=150,captures=0;
    const preview=createMousePreview(element(),{owner:()=>step,scale:()=>scale,locked:()=>false,update(){},capture:async()=>({width:1280,height:480,scale:150,snapshot:`frame-${++captures}`,png:"mock"})});
    assert.throws(()=>preview.selection(),/刷新截图/);
    await preview.load();
    assert.deepEqual(preview.selection(),{snapshot:"frame-1",region:{x:300,y:150,width:100,height:50}});
    // The task baseline changes on another monitor; testing still uses the old displayed pixels.
    scale=300;step.action.region={x:600,y:300,width:200,height:100};
    assert.deepEqual(preview.selection(),{snapshot:"frame-1",region:{x:300,y:150,width:100,height:50}});
    assert.equal(captures,1);
    await preview.load();
    assert.equal(preview.selection().snapshot,"frame-2");
    preview.reset();
    assert.throws(()=>preview.selection(),/刷新截图/);
  } finally {globalThis.document=oldDocument;globalThis.Image=oldImage;}
});

test("OCR reverse drag updates only the selected region and ignores zero area", () => {
  for (const type of ["ocr","match","capture"]) {
    const single={action:{type}};
    applyMousePoints(single,{x:2,y:3},{x:12,y:23});
    assert.deepEqual(single.action.region,{x:2,y:3,width:10,height:20});
    applyMousePoints(single,{x:90,y:80},{x:10,y:20});
    assert.deepEqual(single.action.region,{x:10,y:20,width:80,height:60});
    applyMousePoints(single,{x:10,y:20},{x:10,y:20});
    assert.equal(single.action.region.width,80);
  }
});
