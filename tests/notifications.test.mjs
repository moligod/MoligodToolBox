import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
test("global reminders stack, dismiss and expire without hiding newer reminders", () => {
  const source = read("../src/main.ts");
  const fn = source.slice(
    source.indexOf("function notify("),
    source.indexOf("function failure("),
  );
  const code = ts.transpileModule(fn, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const timers = [];
  const notice = {
    children: [],
    open: false,
    append(t) {
      this.children.push(t);
    },
    get firstElementChild() {
      return this.children[0];
    },
    showPopover() {
      this.open = true;
    },
    hidePopover() {
      this.open = false;
    },
  };
  const document = {
    createElement() {
      return {
        setAttribute(k, v) {
          this[k] = v;
        },
        remove() {
          notice.children = notice.children.filter((t) => t !== this);
        },
      };
    },
  };
  const notify = new Function(
    "notice",
    "document",
    "setTimeout",
    code + ";return notify;",
  )(notice, document, (fn, ms) => timers.push({ fn, ms }));
  notify("任务已保存");
  notify("失败", true);
  assert.equal(notice.children[0].role, "status");
  assert.equal(notice.children[1].role, "alert");
  assert.deepEqual(
    timers.map((t) => t.ms),
    [4000, 8000],
  );
  notify("第三条");
  notify("第四条");
  assert.equal(notice.children.length, 3);
  timers[0].fn();
  assert.equal(notice.open, true);
  notice.children[0].onclick();
  assert.equal(notice.children.length, 2);
  timers.forEach((t) => t.fn());
  assert.equal(notice.children.length, 0);
  assert.equal(notice.open, false);
  notify("");
  assert.equal(notice.open, false);
});
test("automation control lookups refer to existing elements after task button migration", () => {
  const html = read("../index.html");
  const editor = read("../src/automation-editor.ts");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of editor.matchAll(/(?:get|input)(?:<[^>]+>)?\("([^"]+)"\)/g))
    assert.ok(ids.has(m[1]), m[1]);
  const controls = editor.slice(
    editor.indexOf("function controls()"),
    editor.indexOf("function status("),
  );
  for (const m of controls.matchAll(/"(auto-[^"]+)"/g))
    assert.ok(ids.has(m[1]), m[1]);
  assert.ok(!html.includes('id="automation-notice"'));
});
