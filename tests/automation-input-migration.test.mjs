import { test } from "node:test";
import assert from "node:assert/strict";
import { explicitInputWindows } from "../src/automation-input-migration.ts";
import { standaloneComments } from "../src/automation-comment-migration.ts";

const step = (type, fields = {}, extra = {}) => ({delayMs:0,action:{type,...fields},...extra});
test("legacy input targets become preceding focus actions in the same branch and preserve timing and content", () => {
  const input = step("text",{target:"window:QQ",text:"两行\n文字"},{delayMs:25,randomDelayMs:9,annotation:"旧注解",extra:"keep"});
  const source = [step("group",{name:"组",steps:[
    step("if",{expression:"true"}), input,
    step("else"),step("key",{target:"A",keys:[17,65],holdMs:30}),step("endIf"),
  ]})];
  const before = structuredClone(source);
  const migrated = explicitInputWindows(source);
  const body = migrated[0].action.steps;
  assert.deepEqual(body.map(s=>s.action.type),["if","focus","text","else","focus","key","endIf"]);
  assert.deepEqual(body[1],step("focus",{target:"window:QQ"},{delayMs:25,randomDelayMs:9}));
  assert.deepEqual(body[2],step("text",{text:"两行\n文字"},{delayMs:0,randomDelayMs:0,annotation:"旧注解",extra:"keep"}));
  assert.deepEqual(body[4],step("focus",{target:"A"}));
  assert.deepEqual(body[5],step("key",{keys:[17,65],holdMs:30}));
  assert.deepEqual(explicitInputWindows(migrated),migrated);
  assert.deepEqual(source,before);
  const withNotes = standaloneComments(migrated)[0].action.steps;
  assert.deepEqual(withNotes.slice(0,4).map(s=>s.action.type),["if","focus","text","comment"]);
});
test("foreground input stays unchanged and invalid or excessive conversions leave the source intact", () => {
  const source = [step("key",{keys:[32]}),step("text",{text:"hello"})];
  assert.deepEqual(explicitInputWindows(source),source);
  for (const target of [null,""]) {
    const legacy = step("text",{target,text:"hello"},{delayMs:5});
    assert.deepEqual(explicitInputWindows([legacy]),[step("text",{text:"hello"},{delayMs:5})]);
    assert.equal(legacy.action.target,target);
  }
  const invalid = [step("text",{target:42,text:"hello"})];
  const excessive = [...Array.from({length:999},()=>step("wait",{ms:0})),step("text",{target:"A",text:"hello"})];
  for (const source of [invalid,excessive]) {
    const before = structuredClone(source);
    assert.throws(()=>explicitInputWindows(source),/原脚本已保留/);
    assert.deepEqual(source,before);
  }
});
