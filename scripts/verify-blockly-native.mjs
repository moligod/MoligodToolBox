// Run after a release module build. Uses a fresh data directory and no native input.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import Blockly from "blockly/core";
import { registerHooks } from "node:module";
import {
  scriptToWorkspace,
  workspaceToScript,
} from "../src/automation-blockly-codec.ts";
import { standaloneComments } from "../src/automation-comment-migration.ts";
import { explicitInputWindows } from "../src/automation-input-migration.ts";
import { actionDraft } from "../src/automation-action-draft.ts";
const core = new URL("./blockly.mjs", import.meta.resolve("blockly/core")).href;
const hook = registerHooks({
  resolve(specifier, context, next) {
    return specifier === "blockly/core"
      ? { url: core, shortCircuit: true }
      : next(specifier, context);
  },
});
const { registerBlocks } = await import("../src/automation-blockly-blocks.ts");
hook.deregister();
registerBlocks();
function convert(script) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(
      scriptToWorkspace(script.steps),
      workspace,
    );
    return {
      ...script,
      steps: workspaceToScript(
        Blockly.serialization.workspaces.save(workspace).blocks.blocks,
      ),
    };
  } finally {
    workspace.dispose();
  }
}
const original = JSON.parse(
  await readFile("tests/fixtures/automation-blockly-supported-v1.json", "utf8"),
);
const converted = convert(original);
assert.deepEqual(converted, original);
const directory = await mkdtemp(resolve("target/blockly-native-"));
const child = spawn(
  resolve(`target/${process.argv.includes("--dev") ? "debug" : "release"}/moligod-automation-module.exe`),
  ["--data-dir", directory],
  { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
);
const exited = once(child, "exit");
let data = Buffer.alloc(0),
  serial = 0,
  stderr = "";
const pending = new Map();
child.stderr.on("data", (b) => (stderr += b.toString()));
child.stdout.on("data", (b) => {
  data = Buffer.concat([data, b]);
  while (data.length >= 4 && data.length >= 4 + data.readUInt32LE(0)) {
    const length = data.readUInt32LE(0),
      packet = JSON.parse(data.subarray(4, 4 + length));
    data = data.subarray(4 + length);
    if (packet.type === "reply") {
      pending.get(packet.id)?.(packet.result);
      pending.delete(packet.id);
    }
  }
});
function call(method, payload = null) {
  return new Promise((resolve, reject) => {
    const id = ++serial,
      timer = setTimeout(() => reject(new Error("Timed out " + method)), 10000);
    pending.set(id, (result) => {
      clearTimeout(timer);
      result.Err ? reject(new Error(result.Err)) : resolve(result.Ok);
    });
    const body = Buffer.from(
        JSON.stringify({ protocol: 1, id, method, payload }),
      ),
      prefix = Buffer.alloc(4);
    prefix.writeUInt32LE(body.length);
    child.stdin.write(Buffer.concat([prefix, body]));
  });
}
const s = (type, fields = {}) => ({ delayMs: 0, action: { type, ...fields } });
const withDefaultTiming = (steps) =>
  steps.map((step) => ({
    ...step,
    randomDelayMs: step.randomDelayMs ?? 0,
    action:
      step.action.type === "group"
        ? { ...step.action, steps: withDefaultTiming(step.action.steps) }
        : step.action,
  }));
try {
  const templateBytes = await readFile("src-tauri/icons/32x32.png");
  const templateId = (await call("import-template",templateBytes.toString("base64"))).id;
  assert.ok((await call("template-image",templateId)).png.length > 0);
  await assert.rejects(call("template-image","../file"),/模板标识无效/);
  const anchored={...original,schemaVersion:4,name:"图片选点验收",steps:[s("match",{target:"A",region:{x:0,y:0,width:100,height:100},template:templateId,threshold:0.95,variable:"result",savePosition:true,templatePoint:{x:0,y:0}})]};
  assert.deepEqual(convert(anchored),anchored);
  assert.equal((await call("validate",anchored)).valid,true);
  await assert.rejects(call("validate",{...anchored,schemaVersion:3}),/脚本版本4/);
  const anchoredId="b10c0000-0000-4000-8000-000000000007";
  await call("task-save",{schemaVersion:2,id:anchoredId,name:anchored.name,intervalMs:1000,script:anchored});
  assert.deepEqual((await call("task-load",anchoredId)).script.steps,withDefaultTiming(anchored.steps));
  const numericOcr={...original,schemaVersion:3,name:"数字识别配置验收",steps:[s("ocr",{target:"A",ocrModel:"small",region:{x:0,y:0,width:10,height:10},variable:"result",reuse:true,numbersOnly:true,numericResult:true})]};
  assert.deepEqual(convert(numericOcr),numericOcr);
  assert.equal((await call("validate",numericOcr)).valid,true);
  const numericOcrId="b10c0000-0000-4000-8000-000000000006";
  await call("task-save",{schemaVersion:2,id:numericOcrId,name:numericOcr.name,intervalMs:1000,script:numericOcr});
  assert.deepEqual((await call("task-load",numericOcrId)).script.steps,withDefaultTiming(numericOcr.steps));
  const keyModes={...original,name:"按键模式验证",steps:[s("key",{keys:[65],holdMs:750}),s("keyDown",{keys:[65]}),s("keyUp",{keys:[65]})]};
  assert.deepEqual(convert(keyModes),keyModes);
  assert.equal((await call("validate",convert(keyModes))).valid,true);
  const selected = (mode,value) => ({kind:"selector",mode,value});
  const input2 = (key,value) => ({schemaVersion:2,values:{[key]:value}});
  const input3 = (key,value) => ({schemaVersion:3,values:{[key]:value}});
  const selectorScript={...original,schemaVersion:2,name:"组合取值验证",steps:[
    s("set",{variable:"amount",value:42}),
    {
      ...s("set", { variable: "legacyNumberIsEmpty", value: null }),
      inputs: { schemaVersion: 1, values: { value: {
        kind: "binary", op: "==",
        left: { kind: "variable", name: "amount", valueType: "string" },
        right: { kind: "literal", value: "" },
      } } },
    },
    {...s("set",{variable:"emptyValue",value:0}),inputs:{schemaVersion:1,values:{value:{kind:"literal",value:null}}}},
    {...s("set",{variable:"booleanValue",value:true}),inputs:{schemaVersion:1,values:{value:{kind:"literal",value:false}}}},
    {...s("notify",{text:""}),inputs:input2("text",selected("variable","amount"))},
    {...s("if",{expression:""}),inputs:input2("expression",{kind:"binary",op:"<",left:selected("variable","amount"),right:selected("number",50)})},
    s("set",{variable:"matched",value:true}),s("endIf"),
    {...s("set",{variable:"message",value:null}),inputs:input2("value",selected("string","完成"))},
    s("set",{variable:"code",value:"001"}),
    {...s("set",{variable:"strictMismatch",value:null}),inputs:input3("value",{kind:"binary",op:"==",left:selected("variable","code"),right:selected("number",1),strictEquality:true})},
    {...s("set",{variable:"strictMatch",value:null}),inputs:input3("value",{kind:"binary",op:"==",left:selected("variable","code"),right:selected("string","001"),strictEquality:true})},
    {
      ...s("set", { variable: "literalValuesMatch", value: false }),
      inputs: input3("value", {
        kind: "binary", op: "&&",
        left: {
          kind: "binary", op: "==", strictEquality: true,
          left: selected("variable", "emptyValue"), right: { kind: "literal", value: null },
        },
        right: {
          kind: "binary", op: "==", strictEquality: true,
          left: selected("variable", "booleanValue"), right: { kind: "literal", value: false },
        },
      }),
    },
  ]};
  assert.deepEqual(convert(selectorScript),selectorScript);
  assert.equal((await call("validate",selectorScript)).valid,true);
  const selectorId="b10c0000-0000-4000-8000-000000000005";
  await call("task-save",{schemaVersion:2,id:selectorId,name:selectorScript.name,intervalMs:1000,script:selectorScript});
  assert.deepEqual((await call("task-load",selectorId)).script.steps,withDefaultTiming(selectorScript.steps));
  await call("task-start",{id:selectorId,bindings:{}});
  let selectorStatus;
  for(let n=0;n<100;n++) { selectorStatus=(await call("task-statuses"))[selectorId]; if(!selectorStatus.running) break; await new Promise(r=>setTimeout(r,20)); }
  assert.equal(selectorStatus.phase,"completed",JSON.stringify(selectorStatus));
  assert.equal(selectorStatus.notice,"42");
  assert.equal(selectorStatus.variables.matched,true);
  assert.equal(selectorStatus.variables.legacyNumberIsEmpty,false);
  assert.equal(selectorStatus.variables.message,"完成");
  assert.equal(selectorStatus.variables.strictMismatch,false);
  assert.equal(selectorStatus.variables.strictMatch,true);
  assert.equal(selectorStatus.variables.emptyValue,null);
  assert.equal(selectorStatus.variables.booleanValue,false);
  assert.equal(selectorStatus.variables.literalValuesMatch,true);
  const valuesFixture=JSON.parse(await readFile("tests/fixtures/automation-values-v2.json","utf8"));
  const valueScript=convert(valuesFixture);
  assert.deepEqual(valueScript,valuesFixture);
  assert.equal((await call("validate",valueScript)).valid,true);
  const valueId="b10c0000-0000-4000-8000-000000000004";
  await call("task-save",{schemaVersion:2,id:valueId,name:valueScript.name,intervalMs:1000,script:valueScript});
  const reloaded=await call("task-load",valueId);
  assert.deepEqual(reloaded.script.steps,withDefaultTiming(valueScript.steps));
  await call("task-start",{id:valueId,bindings:{}});
  let valueStatus;
  for(let n=0;n<100;n++) {
    valueStatus=(await call("task-statuses"))[valueId];
    if(!valueStatus.running) break;
    await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(valueStatus.phase,"completed",JSON.stringify(valueStatus));
  assert.equal(valueStatus.variables.total,9);
  assert.equal(valueStatus.notice,"嵌套完成 ${这是文字}");
  const removed = JSON.parse(await readFile("tests/fixtures/automation-blockly-v1.json", "utf8"));
  await assert.rejects(call("validate", removed), /unknown variant.*ocrGroup/);
  const extractOnly = {...removed, steps: removed.steps.filter(step => step.action.type === "setFromOcr")};
  await assert.rejects(call("validate", extractOnly), /unknown variant.*setFromOcr/);
  await assert.rejects(call("ocr-test-group", {}), /未知自动化模块操作/);
  assert.equal((await call("validate", converted)).valid, true);
  const migrated = convert({
    ...original,
    steps: standaloneComments(explicitInputWindows(original.steps)),
  });
  assert.equal((await call("validate", migrated)).valid, true);
  const migratedId = "b10c0000-0000-4000-8000-000000000003";
  await call("task-save", {
    schemaVersion: 2,
    id: migratedId,
    name: migrated.name,
    intervalMs: 1000,
    script: migrated,
  });
  assert.deepEqual(
    withDefaultTiming((await call("task-load", migratedId)).script.steps),
    withDefaultTiming(migrated.steps),
  );
  const id = "b10c0000-0000-4000-8000-000000000001";
  await call("task-save", {
    schemaVersion: 2,
    id,
    name: converted.name,
    intervalMs: 1000,
    script: converted,
  });
  assert.equal(
    (await call("task-load", id)).script.steps.length,
    converted.steps.length,
  );
  const script = convert({
    schemaVersion: 1,
    name: "Blockly Rust执行验收",
    repeats: 1,
    startDelayMs: 0,
    maxRunSeconds: 60,
    steps: [
      s("comment", { text: "独立动作注解\n不发送原生输入" }),
      s("set", { variable: "total", value: 0 }),
      s("group", {
        name: "嵌套计算",
        steps: [
          s("loop", { count: 3 }),
          s("calculate", { variable: "total", expression: "total + 1" }),
          s("endLoop"),
        ],
      }),
      s("if", { expression: "total == 0" }),
      s("assert", { expression: "false", message: "不应执行IF" }),
      s("elseIf", { expression: "total == 3" }),
      s("set", { variable: "branch", value: "elseIf" }),
      s("else"),
      s("assert", { expression: "false", message: "不应执行ELSE" }),
      s("endIf"),
      s("notify", { text: "已完成 ${total} 次" }),
      s("wait", { ms: 10 }),
      s("assert", { expression: "total == 3", message: "循环值错误" }),
    ],
  });
  const runId = "b10c0000-0000-4000-8000-000000000002";
  await call("task-save", {
    schemaVersion: 2,
    id: runId,
    name: script.name,
    intervalMs: 1000,
    loop: false,
    script,
  });
  await call("task-start", { id: runId, bindings: {} });
  let status;
  for (let n = 0; n < 100; n++) {
    status = (await call("task-statuses"))[runId];
    if (!status.running) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(status.phase, "completed", JSON.stringify(status));
  assert.equal(status.variables.total, 3);
  assert.equal(status.variables.branch, "elseIf");
  assert.equal(status.notice, "已完成 3.0 次");
  assert.ok(status.logs.includes("提示：已完成 3.0 次"));
  const subtaskId="b10c0000-0000-4000-8000-000000000003";
  await call("task-save", {schemaVersion:2,id:subtaskId,name:"子任务",intervalMs:60000,loop:true,script:{schemaVersion:1,name:"子任务",startDelayMs:60000,steps:[s("calculate",{variable:"count",expression:"count+1"})]}});
  const callsScript=convert({schemaVersion:1,name:"调用与等待",maxRunSeconds:10,steps:[
    s("set",{variable:"count",value:0}),
    s("waitUntil",{expression:"count == 3",timeoutMs:2000,intervalMs:100}),
    s("runTask",{taskId:subtaskId}),
    s("endWaitUntil"),
    s("notify",{text:"调用完成 ${count}"}),
  ]});
  await call("start",{script:callsScript,bindings:{}});
  let callsStatus;
  for(let n=0;n<150;n++) {
    callsStatus=await call("status");
    if(!callsStatus.running) break;
    await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(callsStatus.phase,"completed",JSON.stringify(callsStatus));
  assert.equal(callsStatus.variables.count,3);
  assert.equal(callsStatus.notice,"调用完成 3.0");
  const stopScript=convert({schemaVersion:1,name:"独立停止任务验收",repeats:0,maxRunSeconds:5,steps:[
    s("set",{variable:"count",value:0}),
    s("loop",{count:0}),
    s("calculate",{variable:"count",expression:"count+1"}),
    s("if",{expression:"count == 2"}),
    actionDraft("stop"),
    s("endIf"),
    s("endLoop"),
    s("set",{variable:"after",value:true}),
  ]});
  await call("start",{script:stopScript,bindings:{}});
  let stopStatus;
  for(let n=0;n<100;n++) {
    stopStatus=await call("status");
    if(!stopStatus.running) break;
    await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(stopStatus.phase,"stopped",JSON.stringify(stopStatus));
  assert.equal(stopStatus.variables.count,2);
  assert.equal(stopStatus.variables.after,undefined);
  assert.equal(stopStatus.round,1);
  const numericTextScript={schemaVersion:2,name:"数字文字比较验收",maxRunSeconds:5,steps:[
    s("set",{variable:"result",value:"784"}),
    {action:{type:"if",expression:"false"},inputs:{schemaVersion:1,values:{expression:{kind:"binary",op:"<",left:{kind:"variable",name:"result",valueType:"number"},right:{kind:"literal",value:785}}}}},
    s("set",{variable:"matched",value:true}),
    s("endIf"),
  ]};
  await call("start",{script:numericTextScript,bindings:{}});
  let numericTextStatus;
  for(let n=0;n<100;n++) {
    numericTextStatus=await call("status");
    if(!numericTextStatus.running) break;
    await new Promise(r=>setTimeout(r,20));
  }
  assert.equal(numericTextStatus.phase,"completed",JSON.stringify(numericTextStatus));
  assert.equal(numericTextStatus.variables.result,"784");
  assert.equal(numericTextStatus.variables.matched,true);
  const componentId="b10c0000-0000-4000-8000-000000000004";
  const componentBlock=scriptToWorkspace([s("group",{name:"验收组件",steps:[s("wait",{ms:100})]})]).blocks.blocks[0].inputs.BODY.block;
  const component={id:componentId,name:"验收组件",scale:100,block:componentBlock};
  assert.equal((await call("component-add",component)).length,1);
  assert.deepEqual((await call("component-list"))[0],component);
  const component2 = {...component,id:"b10c0000-0000-4000-8000-000000000002",name:"第二组件"};
  await call("component-add",component2);
  assert.equal((await call("component-rename",{id:componentId,name:"修改名称"}))[0].name,"修改名称");
  assert.deepEqual((await call("component-move",{id:componentId,targetId:component2.id,after:true})).map(item=>item.id),[component2.id,componentId]);
  assert.deepEqual((await call("component-list")).map(item=>item.id),[component2.id,componentId]);
  await call("component-remove",component2.id);
  assert.equal((await call("component-remove",componentId)).length,0);
  await call("shutdown");
  child.stdin.end();
  const [exitCode] = await exited;
  assert.equal(exitCode, 0);
  assert.equal(stderr, "");
  const report = {
    directory,
    supportedLegacyActionsValidated: true,
    removedActionsAndRpcRejected: true,
    legacyTaskSavedAndLoaded: true,
    migratedCommentsValidatedAndSaved: true,
    nativeInputSent: false,
    nestedValuesSavedReloadedAndExecuted:true,
    valueStatus,
    status,
    callsStatus,
    stopStatus,
    numericTextStatus,
    componentStorageValidated:true,
  };
  await writeFile(
    resolve(directory, "result.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (child.exitCode === null) child.kill();
}
