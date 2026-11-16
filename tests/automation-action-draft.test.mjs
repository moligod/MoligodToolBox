import { test } from "node:test";
import assert from "node:assert/strict";
import { actionDraft, actionIssues, confirmOcrNumericResult, requiredScriptVersion, setOcrNumbersOnly, setWaitDuration, switchMouseAction } from "../src/automation-action-draft.ts";
import {
  parseBlocks,
  writeBlocks,
  moveBlock,
} from "../src/automation-block-model.ts";

test("variable click accepts a point name instead of fixed coordinates", () => {
  const click=actionDraft("click");
  Object.assign(click.action,{target:"A",position:"result"});
  assert.deepEqual(actionIssues(click,()=>true),[]);
  click.action.position="";
  assert.deepEqual(actionIssues(click,()=>true),["请填写位置变量"]);
  delete click.action.position;
  assert.deepEqual(actionIssues(click,()=>true),["请选择位置"]);
  assert.equal(actionDraft("match").action.savePosition,true);
  assert.deepEqual(actionIssues(actionDraft("keyDown"),()=>false),[]);
  assert.deepEqual(actionIssues(actionDraft("keyUp"),()=>false),[]);
  assert.deepEqual(actionIssues(actionDraft("waitUntil"),()=>false),["请填写表达式"]);
  assert.deepEqual(actionIssues(actionDraft("runTask"),()=>false),["请选择要运行的任务"]);
});

test("new OCR actions use global settings while imported model fields survive roundtrips", () => {
  const step = actionDraft("ocr");
  assert.equal(step.action.ocrModel, undefined);
  step.action.ocrModel = "tiny";
  step.action.target = "A";
  step.action.region = { x: 1, y: 2, width: 50, height: 20 };
  const restored = writeBlocks(parseBlocks(JSON.parse(JSON.stringify([step]))));
  assert.equal(restored[0].action.ocrModel, "tiny");
  assert.equal(step.action.ocrModel, "tiny");
  step.action.ocrModel = "unknown";
  assert.ok(actionIssues(step, () => true).includes("请选择有效的 OCR 模型"));
});

test("only explicit numeric OCR configuration changes legacy output", () => {
  const old = {delayMs:0,action:{type:"ocr",numbersOnly:true,variable:"result"}};
  const restored = writeBlocks(parseBlocks(JSON.parse(JSON.stringify([old]))));
  assert.equal(restored[0].action.numericResult,undefined);
  confirmOcrNumericResult(restored[0]);
  assert.equal(restored[0].action.numericResult,true);
  setOcrNumbersOnly(restored[0],false);
  assert.equal(restored[0].action.numbersOnly,false);
  assert.equal(restored[0].action.numericResult,undefined);
  setOcrNumbersOnly(restored[0],true);
  assert.equal(restored[0].action.numericResult,true);
  assert.equal(JSON.parse(JSON.stringify(restored))[0].action.numericResult,true);
  assert.equal(requiredScriptVersion([old]),1);
  assert.equal(requiredScriptVersion(restored),3);
  assert.equal(requiredScriptVersion([{delayMs:0,action:{type:"group",steps:restored}}]),3);
  const query={kind:"query",action:{...restored[0].action,reuse:false}};
  assert.equal(requiredScriptVersion([{delayMs:0,action:{type:"set"},inputs:{schemaVersion:2,values:{value:query}}}]),3);
});

test("OCR stays incomplete until both window binding and region are provided", () => {
  const step = actionDraft("ocr");
  assert.deepEqual(
    actionIssues(step, () => false),
    ["请选择窗口", "请选择区域"],
  );
  step.action.target = "B";
  assert.deepEqual(
    actionIssues(step, () => true),
    ["请选择区域"],
  );
  step.action.region = { x: 0, y: 0, width: 200, height: 80 };
  assert.deepEqual(
    actionIssues(step, (slot) => slot === "B"),
    [],
  );
  assert.deepEqual(
    actionIssues(step, () => false),
    ["请选择窗口"],
  );
  step.action.region.width = 0;
  assert.deepEqual(
    actionIssues(step, () => true),
    ["请选择区域"],
  );
});

test("points and templates must be deliberately configured", () => {
  const click = actionDraft("click");
  click.action.target = "A";
  assert.deepEqual(
    actionIssues(click, () => true),
    ["请选择位置"],
  );
  Object.assign(click.action, { x: 0, y: 0 });
  assert.deepEqual(
    actionIssues(click, () => true),
    [],
  );
  const match = actionDraft("match");
  Object.assign(match.action, { target: "A", region: { x: 0, y: 0, width: 1, height: 1 } });
  assert.deepEqual(
    actionIssues(match, () => true),
    ["请选择匹配模板"],
  );
});

test("wait needs no window; invalid input remains incomplete instead of silently using the old value", () => {
  const wait = actionDraft("wait");
  assert.deepEqual(
    actionIssues(wait, () => false),
    [],
  );
  wait.action.ms = -1000;
  assert.deepEqual(
    actionIssues(wait, () => true),
    ["请填写有效等待时间"],
  );
  const key = actionDraft("key");
  Object.assign(key.action, { target: "A", keys: [0] });
  assert.deepEqual(
    actionIssues(key, () => true),
    ["请填写有效按键"],
  );
});

test("unfinished spatial configuration survives grouping, moves and JSON round trips", () => {
  const original = [actionDraft("wait"), actionDraft("ocr")];
  const blocks = parseBlocks(JSON.parse(JSON.stringify(original)));
  const moved = writeBlocks(moveBlock(blocks, [1], [], 0));
  assert.deepEqual(moved, [original[1], original[0]]);
  const group = actionDraft("group");
  group.action.steps = moved;
  assert.deepEqual(writeBlocks(parseBlocks([group])), [group]);
  assert.deepEqual(
    actionIssues(group.action.steps[0], () => true),
    ["请选择窗口", "请选择区域"],
  );
});

test("window setup requires a title and alias but no existing runtime binding", () => {
  const step = actionDraft("setWindow");
  assert.equal(actionIssues(step, () => false).length, 2);
  Object.assign(step.action, { target: "A", title: "ChatGPT" });
  assert.deepEqual(
    actionIssues(step, () => false),
    [],
  );
  assert.deepEqual(writeBlocks(parseBlocks([step])), [step]);
});


test("single wait duration replaces legacy pre-delay without adding it twice", () => {
  const step = { delayMs: 250, action: { type: "wait", ms: 1500 } };
  setWaitDuration(step, 1750);
  assert.equal(step.delayMs, 0);
  assert.equal(step.action.ms, 1750);
  setWaitDuration(step, 3660000);
  assert.equal(step.action.ms + step.delayMs, 3660000);
  assert.deepEqual(actionIssues(step, () => false), []);
  setWaitDuration(step, 1000);
  assert.equal(step.delayMs, 0);
  assert.equal(step.action.ms, 1000);
});


test("mouse operation switching preserves common settings and removes incompatible fields", () => {
  const step = { delayMs: 120, annotation: "备注", action: { type: "click", target: "B", x: 12, y: 34, button: "right", holdMs: 60, jitter: 0 } };
  switchMouseAction(step, "drag");
  assert.deepEqual(step.action, { type: "drag", target: "B", fromX: 12, fromY: 34, toX: -1, toY: -1, durationMs: 500, button: "right" });
  step.action.toX = 40;
  switchMouseAction(step, "drag");
  assert.equal(step.action.toX, 40);
  switchMouseAction(step, "scroll");
  assert.deepEqual(step.action, { type: "scroll", target: "B", x: 12, y: 34, delta: -120 });
  switchMouseAction(step, "click");
  assert.equal(step.action.x, 12);
  assert.equal(step.action.y, 34);
  assert.equal(step.delayMs, 120);
  assert.equal(step.annotation, "备注");
  const before = structuredClone(step);
  switchMouseAction(step, "key");
  assert.deepEqual(step, before);
});

test("background mode survives mouse type changes and script roundtrip", () => {
  const step = actionDraft("click");
  step.action.mode = "background";
  for (const type of ["drag", "scroll", "click"]) {
    switchMouseAction(step, type);
    assert.equal(step.action.mode, "background");
    assert.equal(writeBlocks(parseBlocks([step]))[0].action.mode, "background");
  }
});

test("key and text allow current foreground but validate an explicit target", () => {
  for (const type of ["key", "text"]) {
    const step = actionDraft(type);
    if (type === "text") step.action.text = "hello";
    assert.equal(step.action.target, undefined);
    assert.deepEqual(actionIssues(step, () => false), []);
    step.action.target = "window:QQ";
    assert.deepEqual(actionIssues(step, () => false), ["请选择窗口"]);
    assert.deepEqual(actionIssues(step, () => true), []);
    delete step.action.target;
    assert.deepEqual(actionIssues(step, () => false), []);
  }
});

