import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/automation-editor.ts", import.meta.url), "utf8");
const tree = ts.createSourceFile("editor.ts", source, ts.ScriptTarget.Latest, true);
let callback;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'get("auto-capture-directory").addEventListener') callback = node.arguments[1].getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(callback);
const factory = new Function("task", "editing", "state", "chooseCaptureDirectory", "fillStepFields", `return (${callback});`);
test("folder selection updates only the active capture action and cancellation preserves its folder", async () => {
  for (const chosen of [null, "C:\\Screenshots"]) {
    let pending, updates=0, renders=0;
    const owner={step:{action:{type:"capture",directory:"C:\\old"}},update(){updates++;}};
    const click=factory(work=>{pending=work();},owner,{running:false},async()=>chosen,()=>renders++);
    click(); await pending;
    assert.equal(owner.step.action.directory,chosen ?? "C:\\old");
    assert.equal(updates,chosen ? 1 : 0);
    assert.equal(renders,chosen ? 1 : 0);
  }
});
test("late folder result cannot change an action after its type was switched", async () => {
  let pending, finish;
  const owner={step:{action:{type:"capture"}},update(){assert.fail("stale update");}};
  const click=factory(work=>{pending=work();},owner,{running:false},()=>new Promise(resolve=>{finish=resolve;}),()=>assert.fail("stale render"));
  click(); owner.step.action={type:"ocr"}; finish("C:\\Screenshots"); await pending;
  assert.deepEqual(owner.step.action,{type:"ocr"});
});
