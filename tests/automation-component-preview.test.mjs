import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import ts from "typescript";

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
  compilerOptions: {target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS},
}).outputText;

test("palette scale stays fixed and component width is capped at a quarter of the editor", () => {
  class ToolboxCategory { constructor(name) { this.name = name; } getName() { return this.name; } }
  class VerticalFlyout { getWidth() { return this.naturalWidth; } }
  const module = {};
  new Function("exports", "require", compile("../src/automation-blockly-dock.ts"))(module, () => ({Toolbox:class {}, VerticalFlyout, ToolboxCategory}));
  const flyout = new module.DockedFlyout();
  let selected = new ToolboxCategory("组件库"), width = 1600;
  flyout.naturalWidth = 700;
  flyout.targetWorkspace = {getToolbox:()=>({getSelectedItem:()=>selected}), getInjectionDiv:()=>({clientWidth:width})};
  assert.equal(flyout.getWidth(), 400);
  width = 800;
  assert.equal(flyout.getWidth(), 200);
  flyout.naturalWidth = 180;
  assert.equal(flyout.getWidth(), 180);
  selected = new ToolboxCategory("基础操作");
  flyout.naturalWidth = 700;
  assert.equal(flyout.getWidth(), 700);
  for (const scale of [0.3, 0.9, 1.5]) {
    flyout.targetWorkspace.scale = scale;
    assert.equal(flyout.getFlyoutScale(), 0.9);
  }
});

function fixture(t) {
  const dom = new JSDOM('<div><svg class="blocklyFlyout"></svg></div>');
  t.after(() => dom.window.close());
  const doc = dom.window.document, host = doc.querySelector("div"), svg = doc.querySelector("svg");
  const matrix = {a:1,b:0,inverse:()=>({offset:100})};
  svg.getClientRects = () => [1];
  svg.getBoundingClientRect = () => ({left:100,right:400,width:300});
  class FlyoutButton {
    constructor(id) {
      this.info = {id:`component-pan-${id}`};
      this.root = doc.createElementNS(svg.namespaceURI, "g");
      this.root.innerHTML = '<text class="blocklyFlyoutLabelText"> </text>';
      this.root.querySelector("text").getBBox = () => ({y:0});
      this.root.getScreenCTM = () => matrix;
      this.root.getBoundingClientRect = () => ({top:20});
      svg.append(this.root);
    }
    getSvgRoot() { return this.root; }
  }
  const blocks = new Map(["first","second"].map(id => [`component-preview-${id}`, {
    x:14, width:600,
    getRelativeToSurfaceXY() { return {x:this.x}; },
    getHeightWidth() { return {width:this.width}; },
    getSvgRoot() { return {getBoundingClientRect:()=>({left:100+this.x})}; },
    moveBy(delta) { this.x += delta; },
  }]));
  let labels = [new FlyoutButton("first"), new FlyoutButton("second")];
  const workspace = {
    getInjectionDiv:()=>host,
    getFlyout:()=>({getContents:()=>labels.map(label=>({getElement:()=>label})), getWorkspace:()=>({getBlockById:id=>blocks.get(id)})}),
  };
  const module = {};
  new Function("exports", "require", "document", "DOMPoint", compile("../src/automation-component-preview.ts"))(
    module, () => ({FlyoutButton, Events:{disable() {},enable() {}}}), doc,
    class { constructor(x,y) { this.x=x;this.y=y; } matrixTransform(m) { return {x:this.x-m.offset,y:this.y}; } },
  );
  const previews = module.installComponentPreviews(workspace, id=>id);
  t.after(()=>previews.dispose());
  previews.layout();
  const pan = (index, offset) => {
    const scroller = labels[index].root.querySelector(".auto-component-pan");
    scroller.scrollLeft = offset;
    scroller.dispatchEvent(new dom.window.Event("scroll"));
    return scroller;
  };
  return {previews,blocks,pan,svg,labels,clear:()=>{labels=[];},Event:dom.window.Event};
}

test("each expanded component scrolls independently and resizing restores a preview that fits", t => {
  const view = fixture(t);
  const first = view.blocks.get("component-preview-first"), second = view.blocks.get("component-preview-second");
  view.pan(0, 100);
  assert.equal(first.x, -86);
  assert.equal(second.x, 14);
  view.pan(1, 50);
  assert.equal(second.x, -36);
  assert.equal(first.x, -86);
  first.width = 100;
  view.previews.layout();
  assert.equal(first.x, 14);
  assert.equal(second.x, -36);
});

test("collapsed and disposed component previews release scroll controls and listeners", t => {
  const view = fixture(t);
  const oldScroller = view.pan(0, 30), first = view.blocks.get("component-preview-first");
  view.clear();
  view.previews.layout();
  assert.equal(view.svg.querySelectorAll("foreignObject").length, 0);
  oldScroller.scrollLeft = 80;
  oldScroller.dispatchEvent(new view.Event("scroll"));
  assert.equal(first.x, -16);
  view.previews.dispose();
});
