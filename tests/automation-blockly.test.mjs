import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Blockly from "blockly/core";
import { registerHooks } from "node:module";
// Exercise the same ESM entry the browser uses; core-node above supplies XML dependencies.
const browserCore = new URL(
  "./blockly.mjs",
  import.meta.resolve("blockly/core"),
).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return specifier === "blockly/core"
      ? { url: browserCore, shortCircuit: true }
      : next(specifier, context);
  },
});
const { registerBlocks, services } =
  await import("../src/automation-blockly-blocks.ts");
const { selectedRoots, moveSelected } =
  await import("../src/automation-blockly-multidrag.ts");
const { componentState, scaledComponent, validateComponentImport } = await import("../src/automation-component-model.ts");
hooks.deregister();
import {
  scriptToWorkspace,
  workspaceToScript,
  ACTION_BLOCK,
  encodeValue,
} from "../src/automation-blockly-codec.ts";
import { actionToolbox, valuePalette } from "../src/automation-blockly-toolbox.ts";
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/automation-blockly-supported-v1.json", import.meta.url),
    "utf8",
  ),
);
registerBlocks();

test("official component files pass the normal component import validator", () => {
  const catalog = JSON.parse(readFileSync(new URL("../official-components/index.json", import.meta.url), "utf8"));
  for (const component of catalog.components) {
    validateComponentImport(readFileSync(new URL(`../official-components/${component.id}.json`, import.meta.url), "utf8"));
  }
});

test("component import validates legacy and scaled action trees before writing", () => {
  const library = JSON.parse(readFileSync(new URL("./fixtures/automation-components-v1.json", import.meta.url), "utf8"));
  validateComponentImport(JSON.stringify(library));
  validateComponentImport("\uFEFF" + JSON.stringify(library));
  library.components[1].block.inputs = { UNKNOWN: { block: { type: "unknown_block_type" } } };
  const recordUndo = Blockly.Events.getRecordUndo(), group = Blockly.Events.getGroup();
  assert.throws(() => validateComponentImport(JSON.stringify(library)));
  assert.equal(Blockly.Events.getRecordUndo(), recordUndo);
  assert.equal(Blockly.Events.getGroup(), group);
  delete library.components[1].block.extraState;
  assert.throws(() => validateComponentImport(JSON.stringify(library)));
  assert.throws(() => validateComponentImport('{"schemaVersion":2,"components":[]}'));
});

test("component snapshots only selected actions in order and keeps selected containers intact", t => {
  const steps = [
    {delayMs:0,action:{type:"wait",ms:1000}},
    {delayMs:0,action:{type:"wait",ms:2000}},
    {delayMs:0,action:{type:"if",expression:"result > 0"}},
    {delayMs:0,action:{type:"wait",ms:3000}},
    {delayMs:0,action:{type:"endIf"}},
    {delayMs:0,action:{type:"wait",ms:4000}},
  ];
  const workspace = load(t, steps);
  const action = predicate => workspace.getAllBlocks(false).find(b => b.type === ACTION_BLOCK && predicate(b.payload.step.action));
  const ids = new Set([action(a=>a.ms===1000).id,action(a=>a.type==="if").id,action(a=>a.ms===3000).id,action(a=>a.ms===4000).id]);
  const saved = componentState(selectedRoots(workspace,ids),"我的组件");
  const result = workspaceToScript([{type:"moligod_start",inputs:{BODY:{block:saved}}}]);
  assert.equal(result[0].action.type,"group");
  assert.equal(result[0].action.name,"我的组件");
  assert.deepEqual(result[0].action.steps.map(s=>s.action.ms ?? s.action.type),[1000,"if",3000,"endIf",4000]);
  assert.deepEqual(save(workspace),steps);
  assert.throws(()=>componentState([],"empty"),/选中/);
});

test("component placement converts coordinates between known task scales", t => {
  const steps = [{delayMs:0,action:{type:"click",target:"A",x:100,y:200,button:"left",holdMs:30}}];
  const workspace = load(t,steps);
  const root = workspace.getAllBlocks(false).find(b=>b.type===ACTION_BLOCK);
  const original = componentState([root],"点击");
  const item = {id:"1",name:"点击",block:original,scale:100};
  const scaled = scaledComponent(item,150);
  const group = workspaceToScript([{type:"moligod_start",inputs:{BODY:{block:scaled}}}])[0];
  assert.equal(group.action.steps[0].action.x,150);
  assert.equal(group.action.steps[0].action.y,300);
  assert.equal(workspaceToScript([{type:"moligod_start",inputs:{BODY:{block:original}}}])[0].action.steps[0].action.x,100);
  assert.throws(()=>scaledComponent(item,undefined),/缩放/);
});

test("multi-drag moves nonadjacent nested actions together and undo restores the original tree", async t => {
  const steps = [
    {delayMs:0,action:{type:"wait",ms:1000}},
    {delayMs:0,action:{type:"wait",ms:2000}},
    {delayMs:0,action:{type:"if",expression:"result > 0"}},
    {delayMs:0,action:{type:"wait",ms:3000}},
    {delayMs:0,action:{type:"wait",ms:4000}},
    {delayMs:0,action:{type:"endIf"}},
    {delayMs:0,action:{type:"wait",ms:5000}},
  ];
  const workspace = load(t, steps);
  await new Promise(resolve => setTimeout(resolve, 10));
  workspace.clearUndo();
  const action = ms => workspace.getAllBlocks(false).find(b => b.type === ACTION_BLOCK && b.payload.step.action.ms === ms);
  const roots = selectedRoots(workspace, new Set([action(1000).id, action(3000).id]));
  moveSelected(workspace, roots, {connection:action(5000).nextConnection}, 0, 0);
  assert.deepEqual(save(workspace).map(step => step.action.ms ?? step.action.type), [2000, "if", 4000, "endIf", 5000, 1000, 3000]);
  await new Promise(resolve => setTimeout(resolve, 10));
  workspace.undo(false);
  assert.deepEqual(save(workspace), steps);
  workspace.undo(true);
  assert.deepEqual(save(workspace).map(step => step.action.ms ?? step.action.type), [2000, "if", 4000, "endIf", 5000, 1000, 3000]);
});

test("multi-drag retains a selected container's contents and avoids detaching selected descendants twice", t => {
  const steps = [
    {delayMs:0,action:{type:"if",expression:"true"}},
    {delayMs:0,action:{type:"wait",ms:3000}},
    {delayMs:0,action:{type:"endIf"}},
    {delayMs:0,action:{type:"wait",ms:5000}},
  ];
  const workspace = load(t, steps), container = find(workspace,"if"), child = find(workspace,"wait");
  const tail = workspace.getAllBlocks(false).find(b => b.type === ACTION_BLOCK && b.payload.step.action.ms === 5000);
  const roots = selectedRoots(workspace, new Set([container.id, child.id, tail.id]));
  assert.deepEqual(roots.map(block=>block.id), [container.id,tail.id]);
  const start = workspace.getBlockById("moligod-start");
  moveSelected(workspace, roots, {connection:start.getInput("BODY").connection}, 0, 0);
  assert.deepEqual(save(workspace), steps);
});

test("multi-drag inserts actions into a conditional branch without losing its existing contents", async t => {
  const steps = [
    {delayMs:0,action:{type:"wait",ms:1000}},
    {delayMs:0,action:{type:"wait",ms:2000}},
    {delayMs:0,action:{type:"if",expression:"true"}},
    {delayMs:0,action:{type:"wait",ms:3000}},
    {delayMs:0,action:{type:"endIf"}},
    {delayMs:0,action:{type:"wait",ms:5000}},
  ];
  const workspace = load(t, steps);
  await new Promise(resolve => setTimeout(resolve, 10));
  workspace.clearUndo();
  const action = ms => workspace.getAllBlocks(false).find(b => b.type === ACTION_BLOCK && b.payload.step.action.ms === ms);
  const roots = selectedRoots(workspace, new Set([action(1000).id, action(2000).id]));
  moveSelected(workspace, roots, {connection:find(workspace,"if").getInput("BODY_0").connection}, 0, 0);
  assert.deepEqual(save(workspace).map(step => step.action.ms ?? step.action.type), ["if",1000,2000,3000,"endIf",5000]);
  await new Promise(resolve => setTimeout(resolve, 10));
  workspace.undo(false);
  assert.deepEqual(save(workspace), steps);
});

test("a failed group connection restores the original task and undo cannot corrupt it", async t => {
  const steps = [1000,2000,3000].map(ms => ({delayMs:0,action:{type:"wait",ms}}));
  const workspace = load(t, steps);
  await new Promise(resolve => setTimeout(resolve, 10));
  workspace.clearUndo();
  const action = ms => workspace.getAllBlocks(false).find(b => b.type === ACTION_BLOCK && b.payload.step.action.ms === ms);
  const roots = selectedRoots(workspace, new Set([action(1000).id, action(2000).id]));
  const destination = action(3000).nextConnection;
  const connect = destination.connect;
  let once = true;
  destination.connect = function(other) { if (once) { once = false; return false; } return connect.call(this, other); };
  try { assert.throws(() => moveSelected(workspace, roots, {connection:destination}, 0, 0), /无法连接到目标位置/); }
  finally { destination.connect = connect; }
  assert.deepEqual(save(workspace), steps);
  await new Promise(resolve => setTimeout(resolve, 10));
  workspace.undo(false);
  assert.deepEqual(save(workspace), steps);
});

test("record Escape in key, key-down and key-up fields and save its virtual key", t => {
  const workspace = load(t, [
    {delayMs: 0, action: {type: "key", keys: [32], holdMs: 30}},
    {delayMs: 0, action: {type: "keyDown", keys: [32]}},
    {delayMs: 0, action: {type: "keyUp", keys: [32]}},
  ]);
  for (const type of ["key", "keyDown", "keyUp"]) {
    const field = find(workspace, type).getField("keys");
    let prevented = false, stopped = false;
    const prototype = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf(field)));
    const original = prototype.onHtmlInputKeyDown_;
    prototype.onHtmlInputKeyDown_ = () => {};
    try {
      field.onHtmlInputKeyDown_({key:"Escape", code:"Escape", ctrlKey:false, shiftKey:false, altKey:false, preventDefault(){ prevented = true; }, stopPropagation(){ stopped = true; }});
    } finally { prototype.onHtmlInputKeyDown_ = original; }
    assert.equal(field.getValue(), "Esc");
    assert.equal(prevented, true);
    assert.equal(stopped, true);
  }
  assert.deepEqual(save(workspace).map(step => step.action.keys), [[27], [27], [27]]);
});

test("keyboard palette has one action and its mode preserves existing actions and serializes safely", t => {
  const toolbox = actionToolbox([{id:"input",label:"鼠标键盘",actions:["keyDown","keyUp","click","key"].map(type=>({type,name:type}))}]);
  const templates = toolbox.contents.find(category=>category.name === "鼠标键盘").contents;
  assert.deepEqual(templates.map(item=>item.extraState.step.action.type),["key","click"]);
  const legacy = [
    {delayMs:0,action:{type:"key",target:"A",keys:[27],holdMs:3000}},
    {delayMs:0,action:{type:"keyDown",keys:[87]}},
    {delayMs:0,action:{type:"keyUp",keys:[87]}},
  ];
  const workspace = load(t,legacy);
  assert.deepEqual(save(workspace),legacy);
  const click = find(workspace,"key");
  assert.equal(click.getFieldValue("keyMode"),"key");
  click.setFieldValue("keyDown","keyMode");
  assert.equal(click.getInput("KEY_DURATION").isVisible(),false);
  const changed = save(workspace);
  assert.deepEqual(changed[0].action,{type:"keyDown",keys:[27]});
  assert.deepEqual(save(load(t,changed)),changed);
  click.setFieldValue("key","keyMode");
  assert.equal(click.getInput("KEY_DURATION").isVisible(),true);
  assert.deepEqual(save(workspace),legacy);
  const press = find(workspace,"keyDown");
  press.setFieldValue("key","keyMode");
  assert.deepEqual(save(workspace)[1].action,{type:"key",keys:[87],holdMs:30});
  const release = find(workspace,"keyUp");
  release.setFieldValue("keyDown","keyMode");
  assert.deepEqual(save(workspace)[2].action,{type:"keyDown",keys:[87]});
});

test("keyboard mode changes can be undone and redone without losing the click duration", async t => {
  const workspace = load(t,[{delayMs:0,action:{type:"key",keys:[65],holdMs:750}}]);
  const block = find(workspace,"key");
  await new Promise(resolve=>setTimeout(resolve,10));
  workspace.clearUndo();
  block.setFieldValue("keyUp","keyMode");
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(save(workspace)[0].action,{type:"keyUp",keys:[65]});
  workspace.undo(false);
  assert.deepEqual(save(workspace)[0].action,{type:"key",keys:[65],holdMs:750});
  assert.equal(block.getInput("KEY_DURATION").isVisible(),true);
  workspace.undo(true);
  assert.deepEqual(save(workspace)[0].action,{type:"keyUp",keys:[65]});
  assert.equal(block.getInput("KEY_DURATION").isVisible(),false);
});

test("compact basic templates remove comments and preserve editable destinations", t => {
  const toolbox = actionToolbox([{id:"basic",label:"基础操作",actions:["focus","group","comment","set"].map(type=>({type,name:type}))}]);
  const templates = toolbox.contents[0].contents;
  assert.deepEqual(templates.map(item=>item.extraState.step.action.type), ["focus","group"]);
  const workspace = load(t, []);
  const blocks = templates.map(template=>Blockly.serialization.blocks.append(template,workspace));
  assert.match(blocks[0].toString(), /切换窗口.*选择窗口/);
  assert.match(blocks[1].toString(), /新建分组.*分组名/);
  const setTemplate = toolbox.contents.find(category=>category.name === "条件与取值").contents.find(item=>item.extraState?.step?.action.type === "set");
  const set = Blockly.serialization.blocks.append(setTemplate,workspace);
  assert.match(set.toString(), /设置.*result.*为/);
  assert.equal(set.getInput("DESTINATION"),null);
  set.setFieldValue("score","variable");
  assert.equal(set.readState().step.action.variable,"score");
});

test("standalone stop has no condition socket and nests inside an if without changing the native format", t => {
  const toolbox = actionToolbox([{id:"flow",label:"流程控制",actions:[{type:"if",name:"如果"},{type:"assert",name:"停止"}]}]);
  const templates = toolbox.contents[0].contents.filter(item=>item.extraState?.step);
  const workspace = load(t, []);
  const conditional = Blockly.serialization.blocks.append(templates[0],workspace);
  workspace.getBlockById("moligod-start").getInput("BODY").connection.connect(conditional.previousConnection);
  const truth = Blockly.serialization.blocks.append(encodeValue({kind:"literal",value:true}),workspace);
  conditional.getInput("VALUE_expression").connection.connect(truth.outputConnection);
  const stop = Blockly.serialization.blocks.append(templates[1],workspace);
  conditional.getInput("BODY_0").connection.connect(stop.previousConnection);
  assert.equal(stop.toString(),"停止任务");
  assert.equal(stop.getInput("VALUE_expression"),null);
  const steps=save(workspace);
  assert.deepEqual(steps[1].action,{type:"assert",expression:"true",message:"",stopWhenTrue:true});
  assert.deepEqual(save(load(t,steps)),steps);
});

test("new action templates expose empty expression sockets and accept independent conditions",t=>{
  const toolbox=actionToolbox([{id:"flow",label:"流程控制",actions:[{type:"if",name:"如果"},{type:"assert",name:"停止"}]}]);
  const template=toolbox.contents[0].contents.find(item=>item.extraState?.step?.action.type==="if");
  const workspace=load(t,[]);
  const action=Blockly.serialization.blocks.append(template,workspace);
  workspace.getBlockById("moligod-start").getInput("BODY").connection.connect(action.previousConnection);
  assert.equal(action.getInputTargetBlock("VALUE_expression"),null);
  assert.throws(()=>save(workspace),/放入条件或取值/);
  const condition=Blockly.serialization.blocks.append(encodeValue({kind:"expression",source:"result != null",valueType:"boolean"}),workspace);
  action.getInput("VALUE_expression").connection.connect(condition.outputConnection);
  assert.equal(save(workspace)[0].action.expression,"result != null");
  assert.equal(condition.isShadow(),false);
});

test("flow palette uses loops and conditions while existing conditional waits roundtrip unchanged", t => {
  const toolbox = actionToolbox([{id:"flow", label:"流程控制", actions:["holdUntil","waitUntil","endWaitUntil","if","assert","loop","break","continue"].map(type => ({type,name:type}))}]);
  const types = toolbox.contents[0].contents.flatMap(item => item.extraState?.step ? [item.extraState.step.action.type] : []);
  assert.deepEqual(types, ["if","assert","loop","break","continue"]);
  const steps = [
    {delayMs:0,action:{type:"holdUntil",expression:"ready",timeoutMs:10000,intervalMs:500}},
    {delayMs:0,action:{type:"waitUntil",expression:"result > 0",timeoutMs:30000,intervalMs:1000}},
    {delayMs:0,action:{type:"wait",ms:100}},
    {delayMs:0,action:{type:"endWaitUntil"}},
  ];
  assert.deepEqual(save(load(t, steps)), steps);
});

test("legacy expressions are detachable blocks and removing them leaves the socket empty",t=>{
  const workspace=load(t,[{delayMs:0,action:{type:"calculate",expression:"1+1",variable:"result"}}]);
  const action=find(workspace,"calculate"),value=action.getInputTargetBlock("VALUE_expression");
  assert.equal(value.isShadow(),false);
  value.dispose(false);
  assert.equal(action.getInputTargetBlock("VALUE_expression"),null);
  assert.throws(()=>save(workspace),/放入条件或取值/);
});

test("the single save action accepts an independent numeric expression and legacy calculations stay compatible", t => {
  const toolbox = actionToolbox([{id:"basic", label:"基础操作", actions:[{type:"set", name:"保存变量"},{type:"calculate",name:"计算变量"}]}]);
  assert.equal(toolbox.contents.some(category=>category.name === "基础操作"), false);
  const values = toolbox.contents.find(category=>category.name === "条件与取值").contents;
  const templates = values.filter(item=>item.extraState?.step?.action.type === "set");
  assert.equal(templates.length, 1);
  const workspace = load(t, []);
  const action = Blockly.serialization.blocks.append(templates[0], workspace);
  workspace.getBlockById("moligod-start").getInput("BODY").connection.connect(action.previousConnection);
  const expression = Blockly.serialization.blocks.append(encodeValue({kind:"expression", source:"1+1", valueType:"number"}), workspace);
  action.getInput("VALUE_value").connection.connect(expression.outputConnection);
  const steps = save(workspace);
  assert.equal(steps[0].inputs.values.value.source, "1+1");
  assert.deepEqual(save(load(t, steps)), steps);
  const legacy = [{delayMs:0, action:{type:"calculate", variable:"result", expression:"1+1"}}];
  const oldWorkspace = load(t, legacy);
  assert.match(find(oldWorkspace,"calculate").toString(), /设置.*result.*为/);
  assert.deepEqual(save(oldWorkspace), legacy);
});

test("one selector offers number text and variable while preserving legacy value trees", async t => {
  const toolbox = actionToolbox([{id:"basic",label:"基础操作",actions:[{type:"wait",name:"等待"}]}]);
  const values = toolbox.contents.find(category=>category.name === "条件与取值").contents;
  assert.equal(values.filter(item=>item.extraState?.value?.kind === "selector").length,1);
  assert.equal(values.some(item=>["not","query"].includes(item.extraState?.value?.kind)),false);
  const comparisons = values.filter(item=>item.extraState?.value?.kind === "binary" && [">","!="].includes(item.extraState.value.op));
  assert.equal(comparisons.length,1);
  for (const item of comparisons) {
    assert.deepEqual(item.extraState.value.left,{kind:"selector",mode:"variable",value:"result"});
    assert.equal(item.extraState.value.strictEquality,true);
  }
  const comparisonWorkspace = load(t,[{delayMs:0,action:{type:"if",expression:"false"}},{delayMs:0,action:{type:"endIf"}}]);
  const comparison = Blockly.serialization.blocks.append(comparisons[0],comparisonWorkspace);
  find(comparisonWorkspace,"if").getInputTargetBlock("VALUE_expression").dispose(false);
  find(comparisonWorkspace,"if").getInput("VALUE_expression").connection.connect(comparison.outputConnection);
  comparison.setFieldValue("==","OP");
  comparison.getInputTargetBlock("RIGHT").setFieldValue("null", "MODE");
  const comparisonSteps = save(comparisonWorkspace);
  assert.equal(comparisonSteps[0].inputs.schemaVersion,3);
  assert.equal(comparisonSteps[0].inputs.values.expression.strictEquality,true);
  assert.deepEqual(comparisonSteps[0].inputs.values.expression.right, { kind: "literal", value: null });
  assert.deepEqual(save(load(t,comparisonSteps)),comparisonSteps);
  const mislabeledComparison = structuredClone(comparisonSteps);
  mislabeledComparison[0].inputs.schemaVersion = 2;
  assert.throws(()=>scriptToWorkspace(mislabeledComparison),/原数据已保留/);
  const futureComparison = structuredClone(comparisonSteps);
  futureComparison[0].inputs.schemaVersion = 4;
  assert.throws(()=>scriptToWorkspace(futureComparison),/原数据已保留/);
  assert.equal(values.filter(item=>["literal","variable"].includes(item.extraState?.value?.kind) && typeof item.extraState.value.value !== "boolean").length,0);
  const selectorTemplate = values.find(item=>item.extraState?.value?.kind === "selector");
  const workspace = load(t,[{delayMs:0,action:{type:"wait",ms:1000}},{delayMs:0,action:{type:"notify",text:"旧提示"}}]);
  const numeric = Blockly.serialization.blocks.append(selectorTemplate,workspace);
  numeric.setFieldValue(5,"NUMBER");
  find(workspace,"wait").getInput("VALUE_seconds").connection.connect(numeric.outputConnection);
  assert.deepEqual(save(workspace)[0].inputs,{schemaVersion:2,values:{seconds:{kind:"selector",mode:"number",value:5}}});
  numeric.setFieldValue("variable","MODE");
  numeric.setFieldValue("amount","VARIABLE");
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(numeric.getParent(),find(workspace,"wait"));
  assert.deepEqual(save(workspace)[0].inputs.values.seconds,{kind:"selector",mode:"variable",value:"amount"});
  const message = Blockly.serialization.blocks.append(selectorTemplate,workspace);
  message.setFieldValue("string","MODE");
  message.setFieldValue("你好","STRING");
  await new Promise(resolve=>setTimeout(resolve,10));
  find(workspace,"notify").getInput("VALUE_text").connection.connect(message.outputConnection);
  const steps = save(workspace);
  assert.deepEqual(steps[1].inputs,{schemaVersion:2,values:{text:{kind:"selector",mode:"string",value:"你好"}}});
  assert.deepEqual(save(load(t,steps)),steps);
  const legacy = JSON.parse(readFileSync(new URL("./fixtures/automation-values-v2.json",import.meta.url),"utf8"));
  assert.deepEqual(save(load(t,legacy.steps)),legacy.steps);
  const malformed = [{delayMs:0,action:{type:"set",variable:"v",value:0},inputs:{schemaVersion:2,values:{value:{kind:"selector",mode:"future",value:1}}}}];
  const before = structuredClone(malformed);
  assert.throws(()=>scriptToWorkspace(malformed),/原数据已保留/);
  assert.deepEqual(malformed,before);
  const mislabeled = [{delayMs:0,action:{type:"set",variable:"v",value:0},inputs:{schemaVersion:1,values:{value:{kind:"selector",mode:"number",value:1}}}}];
  assert.throws(()=>scriptToWorkspace(mislabeled),/原数据已保留/);
});

test("selector mode changes undo and redo without losing the number or text inputs", async t => {
  const workspace = load(t, []);
  const block = Blockly.serialization.blocks.append(encodeValue({kind:"selector",mode:"number",value:23}), workspace);
  await new Promise(resolve=>setTimeout(resolve,10));
  workspace.clearUndo();
  block.setFieldValue("string","MODE");
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(block.getField("STRING").isVisible(),true);
  workspace.undo(false);
  assert.deepEqual(block.readValue(),{kind:"selector",mode:"number",value:23});
  assert.equal(block.getField("NUMBER").isVisible(),true);
  workspace.undo(true);
  assert.deepEqual(block.readValue(),{kind:"selector",mode:"string",value:""});
  assert.equal(block.getField("STRING").isVisible(),true);
});

test("the unified value selector saves booleans and null with their existing literal format", async t => {
  const workspace = load(t, [{ delayMs: 0, action: { type: "set", variable: "answer", value: 0 } }]);
  const selector = valuePalette().find(item => item.extraState?.value?.kind === "selector");
  const block = Blockly.serialization.blocks.append(selector, workspace);
  find(workspace, "set").getInput("VALUE_value").connection.connect(block.outputConnection);
  assert.deepEqual(block.getField("MODE").getOptions(false).map(option => option[1]),
    ["number", "string", "variable", "boolean", "null"]);
  block.setFieldValue("boolean", "MODE");
  block.setFieldValue("false", "BOOLEAN");
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(block.outputConnection.getCheck(), ["Boolean"]);
  const falseSteps = save(workspace);
  assert.deepEqual(falseSteps[0].inputs.values.value, { kind: "literal", value: false });
  const reopened = load(t, falseSteps);
  const restored = find(reopened, "set").getInputTargetBlock("VALUE_value");
  assert.equal(restored.getFieldValue("MODE"), "boolean");
  assert.equal(restored.getFieldValue("BOOLEAN"), "false");
  assert.deepEqual(save(reopened), falseSteps);
  block.setFieldValue("null", "MODE");
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(block.outputConnection.getCheck(), null);
  assert.deepEqual(save(workspace)[0].inputs.values.value, { kind: "literal", value: null });
  assert.deepEqual(save(load(t, save(workspace))), save(workspace));
  workspace.clearUndo();
  block.setFieldValue("boolean", "MODE");
  await new Promise(resolve => setTimeout(resolve, 10));
  workspace.undo(false);
  assert.deepEqual(save(workspace)[0].inputs.values.value, { kind: "literal", value: null });
  workspace.undo(true);
  assert.deepEqual(save(workspace)[0].inputs.values.value, { kind: "literal", value: false });
});

test("editing comparison operands in the palette keeps them attached when choosing text or booleans", async t => {
  const workspace = load(t, []);
  const template = valuePalette().find(item => item.extraState?.value?.kind === "binary" && item.extraState.value.op === ">");
  const comparison = Blockly.serialization.blocks.append(template, workspace);
  for (const side of ["LEFT", "RIGHT"]) {
    const value = comparison.getInputTargetBlock(side);
    value.setFieldValue("string", "MODE");
    value.setFieldValue("test", "STRING");
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(value.getParent()?.id, comparison.id, side + " text selection detached from the comparison");
    const textClone = Blockly.serialization.blocks.append(Blockly.serialization.blocks.save(comparison), load(t, []));
    assert.deepEqual(textClone.getInputTargetBlock(side).readValue(), { kind: "selector", mode: "string", value: "test" });
    comparison.setFieldValue("==", "OP");
    comparison.setFieldValue(">", "OP");
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(value.getParent()?.id, comparison.id, side + " operator change detached the operand");
    value.setFieldValue("boolean", "MODE");
    value.setFieldValue("false", "BOOLEAN");
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(value.getParent()?.id, comparison.id, side + " boolean selection detached from the comparison");
  }
  comparison.setFieldValue("==", "OP");
  const cloned = Blockly.serialization.blocks.append(Blockly.serialization.blocks.save(comparison), load(t, []));
  assert.deepEqual(cloned.getInputTargetBlock("LEFT").readValue(), { kind: "literal", value: false });
  assert.deepEqual(cloned.getInputTargetBlock("RIGHT").readValue(), { kind: "literal", value: false });
});

test("logic templates need two conditions and reopening does not fill a removed condition with true", async t => {
  const workspace = load(t, [
    { delayMs: 0, action: { type: "if", expression: "" } },
    { delayMs: 0, action: { type: "endIf" } },
  ]);
  const template = valuePalette().find(item => item.extraState?.value?.op === "&&");
  const logic = Blockly.serialization.blocks.append(template, workspace);
  find(workspace, "if").getInput("VALUE_expression").connection.connect(logic.outputConnection);
  assert.equal(logic.getInputTargetBlock("LEFT"), null);
  assert.equal(logic.getInputTargetBlock("RIGHT"), null);
  assert.equal(logic.getField("LEFT_HINT").isVisible(), true);
  assert.throws(() => save(workspace), /左右放入条件/);
  const comparison = Blockly.serialization.blocks.append(encodeValue({
    kind: "binary", op: ">", left: { kind: "literal", value: 1 }, right: { kind: "literal", value: 0 },
  }), workspace);
  const truth = Blockly.serialization.blocks.append(encodeValue({ kind: "literal", value: true }), workspace);
  logic.getInput("LEFT").connection.connect(comparison.outputConnection);
  logic.getInput("RIGHT").connection.connect(truth.outputConnection);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(logic.getField("LEFT_HINT").isVisible(), false);
  assert.equal(logic.getField("RIGHT_HINT").isVisible(), false);
  const steps = save(workspace);
  const reopened = load(t, steps);
  assert.deepEqual(save(reopened), steps);
  const restored = find(reopened, "if").getInputTargetBlock("VALUE_expression");
  restored.getInputTargetBlock("LEFT").dispose(false);
  assert.equal(restored.getInputTargetBlock("LEFT"), null);
  assert.throws(() => save(reopened), /左右放入条件/);
});

test("advanced expressions are directly visible and regex belongs to conditions", t => {
  const palette = valuePalette();
  assert.equal(palette.filter(item => item.kind === "block").length, 7);
  const expressions = palette.filter(item => item.extraState?.value?.kind === "expression");
  assert.equal(expressions.length, 2);
  assert.equal(palette.some(item => item.kind === "button"), false);
  const workspace = load(t, []);
  const [condition, calculation] = expressions.map(item => Blockly.serialization.blocks.append(item, workspace));
  assert.deepEqual(condition.getField("KIND").getOptions(false), [["条件表达式", "expr"], ["正则匹配", "regex"]]);
  assert.match(calculation.toString(), /计算表达式/);
  assert.equal(calculation.getField("KIND"), null);
  condition.setFieldValue("regex", "KIND");
  condition.setFieldValue("code", "REGEX_SOURCE");
  condition.setFieldValue("^[0-9]+$", "PATTERN");
  assert.equal(condition.readValue().source, 'code =~ "^[0-9]+$"');
  const legacy = { kind: "expression", source: 'code =~ "^[0-9]+$"', valueType: "any" };
  assert.deepEqual(Blockly.serialization.blocks.append(encodeValue(legacy), workspace).readValue(), legacy);
});

test("removing a selector variable restores a compatible numeric shadow after reopening", t => {
  const steps=[
    {delayMs:0,action:{type:"if",expression:""},inputs:{schemaVersion:2,values:{expression:{kind:"binary",op:"<",left:{kind:"selector",mode:"variable",value:"result"},right:{kind:"literal",value:10}}}}},
    {delayMs:0,action:{type:"endIf"}},
  ];
  const workspace=load(t,steps);
  assert.deepEqual(save(workspace),steps);
  const comparison=find(workspace,"if").getInputTargetBlock("VALUE_expression");
  comparison.getInputTargetBlock("LEFT").dispose(false);
  const fallback=comparison.getInputTargetBlock("LEFT");
  assert.equal(fallback.isShadow(),true);
  assert.equal(fallback.readValue().value,0);
  assert.equal(fallback.outputConnection.getCheck()[0],"Number");
});

test("legacy recognition queries and negation roundtrip after toolbox removal", t => {
  const query = {kind:"query",action:{type:"ocr",target:"A",region:{x:0,y:0,width:10,height:10},variable:"result",reuse:false,numbersOnly:true,numericResult:true}};
  const legacyCondition = {
    kind: "not",
    value: {
      kind: "query",
      action: {
        type: "match",
        target: "A",
        region: { x: 0, y: 0, width: 10, height: 10 },
        template: "a".repeat(64),
        threshold: 0.95,
        variable: "result",
        savePosition: false,
      },
    },
  };
  const steps=[
    {delayMs:0,action:{type:"if",expression:""},inputs:{schemaVersion:2,values:{expression:{kind:"binary",op:"<",left:query,right:{kind:"literal",value:800}}}}},
    {delayMs:0,action:{type:"endIf"}},
    {
      delayMs: 0,
      action: { type: "if", expression: "" },
      inputs: { schemaVersion: 1, values: { expression: legacyCondition } },
    },
    {delayMs:0,action:{type:"endIf"}},
  ];
  const workspace=load(t,steps);
  assert.deepEqual(save(workspace),steps);
  const comparison=find(workspace,"if").getInputTargetBlock("VALUE_expression");
  assert.equal(comparison.getInputTargetBlock("LEFT").outputConnection.getCheck(),null);
  comparison.getInputTargetBlock("LEFT").dispose(false);
  assert.equal(comparison.getInputTargetBlock("LEFT").readValue().value,0);
});

test("saved template points survive Blockly reopening without adding points to legacy matches", t => {
  const action={type:"match",target:"A",region:{x:0,y:0,width:100,height:100},template:"a".repeat(64),threshold:0.95,variable:"result",savePosition:true};
  const legacy=[{delayMs:0,action}];
  assert.deepEqual(save(load(t,legacy)),legacy);
  const selected=[{delayMs:0,action:{...action,templatePoint:{x:7,y:9}}}];
  assert.deepEqual(save(load(t,selected)),selected);
});

test("wait container and input holds roundtrip and edit without losing their body", (t) => {
  const steps = [
    {delayMs:0,action:{type:"waitUntil",expression:"result != null",timeoutMs:10000,intervalMs:500}},
    {delayMs:0,action:{type:"match",target:"A",region:{x:10,y:20,width:100,height:100},template:"a".repeat(64),threshold:0.95,variable:"result",savePosition:true}},
    {delayMs:0,action:{type:"endWaitUntil"}},
    {delayMs:0,action:{type:"click",target:"A",position:"result",x:-1,y:-1,button:"left"}},
    {delayMs:0,action:{type:"keyDown",keys:[87]}},
    {delayMs:0,action:{type:"keyUp",keys:[87]}},
    {delayMs:0,action:{type:"runTask",taskId:"12345678-1234-1234-1234-123456789abc"}},
  ];
  const workspace=load(t,steps);
  assert.deepEqual(save(workspace),steps);
  const wait=find(workspace,"waitUntil");
  wait.setFieldValue("30","timeoutMs");
  wait.setFieldValue("1","intervalMs");
  find(workspace,"keyDown").setFieldValue("Ctrl + A","keys");
  find(workspace,"keyUp").setFieldValue("Ctrl + A","keys");
  const updated=save(workspace);
  assert.equal(updated[0].action.timeoutMs,30000);
  assert.equal(updated[0].action.intervalMs,1000);
  assert.deepEqual(updated[1],steps[1]);
  assert.deepEqual(updated[3],steps[3]);
  assert.deepEqual(updated[4].action.keys,[17,65]);
  assert.deepEqual(updated[5].action.keys,[17,65]);
  assert.equal(find(workspace,"keyDown").getInput("KEY_DURATION").isVisible(),false);
});

test("typed nested values survive real Blockly save reload and shadows return after removal",t=>{
  const fixture=JSON.parse(readFileSync(new URL("./fixtures/automation-values-v2.json",import.meta.url),"utf8"));
  const workspace=load(t,fixture.steps);
  assert.deepEqual(save(workspace),fixture.steps);
  assert.deepEqual(save(load(t,save(workspace))),fixture.steps);
  const wait=find(workspace,"wait");
  const variable=wait.getInputTargetBlock("VALUE_seconds");
  assert.equal(variable.outputConnection.getCheck()[0],"Number");
  variable.dispose(false);
  assert.equal(wait.getInputTargetBlock("VALUE_seconds").isShadow(),true);
  assert.equal(save(workspace)[1].inputs,undefined);
  assert.equal(save(workspace)[1].action.ms,1000);
  const condition=Blockly.serialization.blocks.append(encodeValue({kind:"literal",value:true}),workspace);
  assert.equal(workspace.connectionChecker.canConnect(wait.getInput("VALUE_seconds").connection,condition.outputConnection,false),false);
  assert.throws(()=>save(workspace),/未连接/);
  condition.dispose(false);
  const root=find(workspace,"waitUntil");
  const before=save(workspace);
  const state=root.readState();root.shape(state);
  assert.deepEqual(save(workspace),before);
});

test("future value formats and unknown slots keep their source untouched",()=>{
  for(const inputs of [{schemaVersion:2,values:{}},{schemaVersion:1,values:{future:{kind:"literal",value:1}}}]) {
    const steps=[{delayMs:0,action:{type:"wait",ms:1000},inputs}],before=structuredClone(steps);
    assert.throws(()=>scriptToWorkspace(steps),/原数据已保留/);
    assert.deepEqual(steps,before);
  }
});

test("new value duration replaces legacy combined wait while existing input timing and stop semantics survive",t=>{
  const workspace=load(t,[{delayMs:500,action:{type:"wait",ms:1000}}]);
  const wait=find(workspace,"wait");
  const value=Blockly.serialization.blocks.append(encodeValue({kind:"literal",value:2}),workspace);
  wait.getInput("VALUE_seconds").connection.connect(value.outputConnection);
  const step=save(workspace)[0];
  assert.equal(step.delayMs,0);assert.equal(step.action.ms,1500);
  assert.equal(step.inputs.values.seconds.value,2);
  step.delayMs=400;
  const stop={delayMs:0,action:{type:"assert",expression:"true",message:"",stopWhenTrue:false},inputs:{schemaVersion:1,values:{expression:{kind:"literal",value:false}}}};
  assert.deepEqual(save(load(t,[step,stop])),[step,stop]);
});
test("removed paired OCR actions are rejected even inside groups without altering the source", () => {
  const legacy = JSON.parse(readFileSync(new URL("./fixtures/automation-blockly-v1.json", import.meta.url), "utf8"));
  const before = structuredClone(legacy);
  assert.throws(() => scriptToWorkspace(legacy.steps), /已移除/);
  for (const step of legacy.steps.filter(step => ["ocrGroup", "setFromOcr"].includes(step.action.type))) {
    assert.throws(() => scriptToWorkspace([{delayMs:0,action:{type:"group",name:"旧组",steps:[step]}}]), /已移除/);
  }
  assert.deepEqual(legacy, before);
});
test("flyout templates create independent complete containers while spatial actions stay incomplete", (t) => {
  const categories = [
    { label: "基础操作", actions: [{ type: "group", name: "分组" }] },
    { label: "鼠标键盘", actions: [{ type: "click", name: "鼠标操作" }] },
    { id: "flow", label: "流程控制", actions: [{ type: "loop", name: "循环开始" }] },
  ];
  const before = structuredClone(categories),
    toolbox = actionToolbox(categories);
  assert.deepEqual(categories, before);
  assert.deepEqual(
    toolbox.contents.map((category) => category.name),
    [...categories.map((category) => category.label),"条件与取值","组件库"],
  );
  const workspace = load(t, []),
    root = workspace.getBlockById("moligod-start");
  assert.ok(toolbox.contents[2].contents.some(item=>item.text==="循环"));
  const template = toolbox.contents[2].contents.find(item => item.extraState?.step.action.type === "loop");
  const first = Blockly.serialization.blocks.append(template, workspace);
  root.getInput("BODY").connection.connect(first.previousConnection);
  const second = Blockly.serialization.blocks.append(template, workspace);
  first.nextConnection.connect(second.previousConnection);
  first.getInputTargetBlock("VALUE_count").setFieldValue(5, "VALUE");
  assert.deepEqual(
    save(workspace).map((step) => step.action.type),
    ["loop", "endLoop", "loop", "endLoop"],
  );
  assert.equal(save(workspace)[0].action.count, 5);
  assert.equal(save(workspace)[2].action.count, 3);
  assert.equal(template.extraState.step.action.count, 3);
  assert.equal(toolbox.contents[1].contents[0].extraState.step.action.x, -1);
  assert.equal(
    toolbox.contents[1].contents[0].extraState.step.action.target,
    "",
  );
});
const save = (workspace) =>
  workspaceToScript(
    Blockly.serialization.workspaces.save(workspace).blocks.blocks,
  );
function load(t, steps = fixture.steps) {
  const workspace = new Blockly.Workspace();
  t.after(() => workspace.dispose());
  Blockly.serialization.workspaces.load(scriptToWorkspace(steps), workspace);
  return workspace;
}
const find = (workspace, type) =>
  workspace
    .getAllBlocks(false)
    .find(
      (b) => b.type === ACTION_BLOCK && b.payload.step.action.type === type,
    );

test("standalone notification can be edited and roundtrips without adding a window target", (t) => {
  const steps = [{delayMs:0,action:{type:"notify",text:"完成 ${result}"}}];
  const workspace = load(t,steps), block = find(workspace,"notify");
  assert.equal(block.getInput("TITLE").fieldRow[0].getValue(),"提示");
  assert.deepEqual(save(workspace),steps);
  block.getInputTargetBlock("VALUE_text").setFieldValue("下一步","VALUE");
  assert.deepEqual(save(workspace),[{delayMs:0,action:{type:"notify",text:"下一步"}}]);
  assert.equal(find(load(t,[{delayMs:0,action:{type:"assert",expression:"true",stopWhenTrue:true,message:"历史内容"}}]),"assert").getField("message"),null);
});

test("recognition templates create three distinct supported actions", (t) => {
  const types = ["ocr", "match", "capture"];
  const labels = [
    "读取文字",
    "查找图片",
    "保存截图",
  ];
  const toolbox = actionToolbox([
    {
      label: "识别截图",
      actions: types.map((type, i) => ({ type, name: labels[i] })),
    },
  ]);
  const workspace = load(t, []);
  let connection = workspace
    .getBlockById("moligod-start")
    .getInput("BODY").connection;
  for (const [index, template] of toolbox.contents[0].contents.entries()) {
    const block = Blockly.serialization.blocks.append(template, workspace);
    connection.connect(block.previousConnection);
    assert.equal(block.getInput("TITLE").fieldRow[0].getValue(), [
      "读取 未选窗口 的文字，保存到 result",
      "在 未选窗口 查找图片，位置保存到 result",
      "截取 未选窗口，保存为 capture",
    ][index]);
    connection = block.nextConnection;
  }
  assert.deepEqual(
    save(workspace).map((step) => step.action.type),
    types,
  );
  assert.deepEqual(save(load(t, save(workspace))), save(workspace));
});

test("supported legacy action kinds survive real Blockly serialization without changing script fields", (t) => {
  const original = structuredClone(fixture);
  const workspace = load(t);
  assert.deepEqual(save(workspace), fixture.steps);
  const again = new Blockly.Workspace();
  t.after(() => again.dispose());
  Blockly.serialization.workspaces.load(
    Blockly.serialization.workspaces.save(workspace),
    again,
  );
  assert.deepEqual(save(again), fixture.steps);
  assert.deepEqual(fixture, original);
});

test("editing one inline field leaves delays, annotations, typed values and other actions untouched", (t) => {
  const workspace = load(t);
  find(workspace, "calculate").getInputTargetBlock("VALUE_expression").setFieldValue("total + 2", "SOURCE");
  const expected = structuredClone(fixture.steps);
  expected.find((s) => s.action.type === "calculate").action.expression =
    "total + 2";
  assert.deepEqual(save(workspace), expected);
  const literal=find(workspace,"set").getInputTargetBlock("VALUE_value");
  literal.loadExtraState({value:{kind:"literal",value:"123"}});
  assert.equal(
    save(workspace).find((s) => s.action.type === "set").action.value,
    "123",
  );
});

test("stop condition shows the inverse for legacy assertions and stores positive semantics when edited", (t) => {
  const old = [{delayMs:0,action:{type:"assert",expression:"result > 0",message:"停止"}}];
  const workspace = load(t, old), block = find(workspace,"assert");
  assert.equal(block.getInputTargetBlock("VALUE_expression").getFieldValue("SOURCE"),"!(result > 0)");
  assert.deepEqual(save(workspace),old);
  block.getInputTargetBlock("VALUE_expression").setFieldValue("result < 10","SOURCE");
  assert.deepEqual(save(workspace)[0].action,{type:"assert",expression:"result < 10",message:"停止",stopWhenTrue:true});
  assert.equal(find(load(t,save(workspace)),"assert").getInputTargetBlock("VALUE_expression").getFieldValue("SOURCE"),"result < 10");
});

test("standalone comments preserve multiline text and support mutation undo/redo", (t) => {
  const steps = [
    { delayMs: 0, action: { type: "wait", ms: 1000 } },
    { delayMs: 0, action: { type: "comment", text: "第一行\n第二行" } },
  ];
  const workspace = load(t, steps);
  const block = find(workspace, "comment");
  assert.equal(block.getInput("TITLE").fieldRow[0].getValue(), "⠿");
  assert.ok(
    block
      .getInput("TITLE")
      .fieldRow.every((field) => field.getValue() !== "注解"),
  );
  assert.equal(block.getFieldValue("text"), "第一行\n第二行");
  const before = block.readState();
  block.setFieldValue("修改\n仍然两行", "text");
  const after = block.readState();
  assert.equal(save(workspace)[1].action.text, "修改\n仍然两行");
  const event = new Blockly.Events.BlockChange(
    block,
    "mutation",
    null,
    JSON.stringify(before),
    JSON.stringify(after),
  );
  event.run(false);
  assert.deepEqual(save(workspace), steps);
  event.run(true);
  assert.equal(save(workspace)[1].action.text, "修改\n仍然两行");
  assert.deepEqual(save(load(t, save(workspace))), save(workspace));
});

test("comment blocks move independently and original action parameters survive", (t) => {
  const steps = [
    { delayMs: 17, randomDelayMs: 9, action: { type: "wait", ms: 1000 } },
    { delayMs: 0, action: { type: "comment", text: "说明" } },
    { delayMs: 0, action: { type: "wait", ms: 2000 } },
  ];
  const workspace = load(t, steps);
  const note = find(workspace, "comment");
  note.unplug(true);
  const root = workspace
    .getBlockById("moligod-start")
    .getInput("BODY").connection;
  const first = root.targetConnection;
  root.disconnect();
  root.connect(note.previousConnection);
  note.nextConnection.connect(first);
  assert.deepEqual(save(workspace), [steps[1], steps[0], steps[2]]);
  note.dispose(true);
  assert.deepEqual(save(workspace), [steps[0], steps[2]]);
});

test("actions no longer expose attached note fields or buttons", (t) => {
  const workspace = load(t);
  const buttons = (type) =>
    find(workspace, type)
      .getInput("TITLE")
      .fieldRow.filter((field) => field instanceof Blockly.FieldImage)
      .map((field) => field.getText());
  for (const type of [
    "wait",
    "group",
    "loop",
    "if",
    "set",
    "calculate",
    "key",
    "text",
    "focus",
    "comment",
  ])
    assert.deepEqual(buttons(type), []);
  for (const type of [
    "click",
    "drag",
    "scroll",
    "ocr",
    "match",
    "capture",
  ])
    assert.deepEqual(buttons(type), ["设置动作"]);
  for (const block of workspace.getAllBlocks(false))
    assert.ok(
      block.inputList.every((input) => !input.name.startsWith("NOTE_")),
    );
  assert.deepEqual(save(workspace), fixture.steps);
});

test("window options discard closed unselected windows without changing the selected target", (t) => {
  const step = {
    delayMs: 0,
    action: { type: "focus", target: "window:原目标" },
  };
  const workspace = load(t, [step]);
  let windows = ["原目标", "已关闭窗口"];
  services.set(workspace, {
    names: {},
    windows: () => windows,
    slots: () => [],
    refresh: async () => {},
  });
  t.after(() => services.delete(workspace));
  const block = find(workspace, "focus");
  block.shape(block.readState());
  const field = block.getField("target");
  assert.ok(
    field.getOptions(false).some((option) => option[1] === "window:已关闭窗口"),
  );
  windows = ["新窗口"];
  assert.deepEqual(
    field.getOptions(false).map((option) => option[1]),
    ["", "window:新窗口", "window:原目标"],
  );
  assert.equal(field.getValue(), "window:原目标");
  assert.deepEqual(save(workspace), [step]);
  field.setValue("window:新窗口");
  windows = ["另一个窗口"];
  assert.deepEqual(
    field.getOptions(false).map((option) => option[1]),
    ["", "window:另一个窗口", "window:新窗口"],
  );
  assert.equal(save(workspace)[0].action.target, "window:新窗口");
});

test("ordinary blocks reconnect in both directions and nested groups move as complete structures", (t) => {
  const workspace = load(t, [
    { delayMs: 0, action: { type: "wait", ms: 1000 } },
    {
      delayMs: 1,
      action: {
        type: "group",
        name: "G",
        steps: [{ delayMs: 2, action: { type: "wait", ms: 2000 } }],
      },
    },
    { delayMs: 3, action: { type: "wait", ms: 3000 } },
  ]);
  const root = workspace.getBlockById("moligod-start");
  const first = root.getInputTargetBlock("BODY"),
    group = first.getNextBlock(),
    last = group.getNextBlock();
  group.unplug(true);
  last.nextConnection.connect(group.previousConnection);
  assert.deepEqual(
    save(workspace).map((s) => s.action.type),
    ["wait", "wait", "group"],
  );
  assert.equal(save(workspace)[2].action.steps[0].action.ms, 2000);
  group.unplug(true);
  root.getInput("BODY").connection.connect(group.previousConnection);
  assert.equal(save(workspace)[0].action.type, "group");
});

test("unconnected blocks refuse export instead of silently losing actions", (t) => {
  const workspace = load(t);
  find(workspace, "capture").unplug(true);
  assert.throws(() => save(workspace), /未连接/);
  assert.ok(find(workspace, "capture"));
});

test("moving a group retains nested bodies and heals only its surrounding siblings", (t) => {
  const wait = (ms) => ({ delayMs: 0, action: { type: "wait", ms } });
  const groupStep = {
    delayMs: 0,
    action: {
      type: "group",
      name: "组",
      steps: [
        { delayMs: 0, action: { type: "loop", count: 2 } },
        wait(20),
        { delayMs: 0, action: { type: "endLoop" } },
      ],
    },
  };
  const steps = [wait(10), groupStep, wait(30)];
  const workspace = load(t, steps),
    group = find(workspace, "group");
  const childIds = group
    .getInputTargetBlock("BODY_0")
    .getDescendants(false)
    .map((b) => b.id);
  group.unplug(true);
  assert.equal(group.getNextBlock(), null);
  assert.deepEqual(
    group
      .getInputTargetBlock("BODY_0")
      .getDescendants(false)
      .map((b) => b.id),
    childIds,
  );
  const first = workspace
    .getBlockById("moligod-start")
    .getInputTargetBlock("BODY");
  const last = first.getNextBlock();
  assert.equal(last.readState().step.action.ms, 30);
  last.nextConnection.connect(group.previousConnection);
  assert.deepEqual(save(workspace), [steps[0], steps[2], groupStep]);
});

test("condition mode edits compile back to Rust expressions and preserve branch tail metadata", (t) => {
  const workspace = load(t);
  const condition = find(workspace, "if");
  condition.getInputTargetBlock("VALUE_expression").setFieldValue("regex", "KIND");
  condition.getInputTargetBlock("VALUE_expression").setFieldValue("a", "REGEX_SOURCE");
  condition.getInputTargetBlock("VALUE_expression").setFieldValue("\\d+", "PATTERN");
  const steps = save(workspace).find((s) => s.action.type === "group").action
    .steps;
  assert.equal(steps[1].action.expression, "a =~ " + JSON.stringify("\\d+"));
  assert.deepEqual(
    steps.slice(2),
    fixture.steps.find((s) => s.action.type === "group").action.steps.slice(2),
  );
});

test("unknown fields and unfinished parameters are retained and malformed containers are rejected", (t) => {
  const steps = [
    {
      delayMs: 0,
      annotation: "",
      action: {
        type: "click",
        target: "",
        x: -1,
        y: -1,
        button: "left",
        future: { x: 42 },
      },
    },
  ];
  assert.deepEqual(save(load(t, steps)), steps);
  assert.throws(
    () =>
      scriptToWorkspace([
        { delayMs: 0, action: { type: "if", expression: "true" } },
      ]),
    /缺少结束/,
  );
});

test("branch mutation retains connected children and is serializable for undo/redo", (t) => {
  const workspace = load(t);
  const block = find(workspace, "if"),
    before = block.readState();
  const children = before.branches.map(
    (b) => block.getInputTargetBlock("BODY_" + b.key)?.id,
  );
  const after = structuredClone(before);
  after.branches.splice(1, 0, {
    key: "new",
    head: { delayMs: 0, action: { type: "elseIf", expression: "total < 0" } },
  });
  block.loadExtraState(after);
  assert.deepEqual(
    before.branches.map((b) => block.getInputTargetBlock("BODY_" + b.key)?.id),
    children,
  );
  block.loadExtraState(before);
  assert.deepEqual(save(workspace), fixture.steps);
});
