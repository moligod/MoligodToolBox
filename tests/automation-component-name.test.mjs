import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(new URL("../src/automation-blockly-components.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } },
).outputText.replace(/^import .*?;\r?\n/gms, "").replace('import("./official-components")', 'loadOfficialModule()').replace("export function installComponents", "function installComponents");

async function fixture(t, loadOfficialModule = () => assert.fail("unexpected official component loading")) {
  const dom = new JSDOM('<div><svg class="blocklyFlyout"></svg></div>');
  t.after(() => dom.window.close());
  const { document, KeyboardEvent, Event } = dom.window;
  dom.window.confirm = () => assert.fail("component deletion opened a browser confirmation");
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
    this.querySelector("[autofocus]")?.focus();
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  const host = document.querySelector("div"), svg = document.querySelector("svg");
  const matrix = { a: 1, b: 0, inverse() { return this; } };
  svg.getClientRects = () => [{}];
  svg.getBoundingClientRect = () => ({ left: 0, right: 500 });
  let items = [{ id: "first", name: "原组件" }, { id: "second", name: "第二个组件" }];
  let labels = [], readOnly = false;
  class ToolboxCategory { getName() { return "组件库"; } }
  class FlyoutButton {
    constructor(item) {
      this.info = { id: `component-${item.id}` };
      this.root = document.createElementNS(svg.namespaceURI, "g");
      this.root.innerHTML = '<text class="blocklyFlyoutLabelText"></text>';
      const text = this.root.querySelector("text");
      text.textContent = item.name;
      text.getBBox = () => ({ x: 0, y: 0, width: 80, height: 18 });
      this.root.getScreenCTM = () => matrix;
      this.root.getBoundingClientRect = () => ({ top: 20 });
      svg.append(this.root);
    }
    getSvgRoot() { return this.root; }
    isLabel() { return true; }
  }
  const callbacks = new Map(), buttons = new Map(), calls = [], notices = [], exports = [], removals = [];
  const category = new ToolboxCategory();
  const workspace = {
    isReadOnly: () => readOnly,
    getToolbox: () => ({ getSelectedItem: () => category }),
    getFlyout: () => ({ getContents: () => labels.map(label => ({ getElement: () => label })) }),
    getInjectionDiv: () => host,
    registerButtonCallback: (key, callback) => buttons.set(key, callback),
    registerToolboxCategoryCallback: (key, callback) => callbacks.set(key, callback),
    refreshToolboxSelection() {
      svg.replaceChildren();
      labels = [{id:"import", name:"导入组件库"}, ...items].map(item => new FlyoutButton(item));
    },
  };
  const backend = {
    list: async () => structuredClone(items),
    import: async text => {
      const library = JSON.parse(text);
      items.push(...library.components);
      return structuredClone(items);
    },
    remove: async id => {
      removals.push(id);
      items = items.filter(item => item.id !== id);
      return structuredClone(items);
    },
    rename: async (id, name) => {
      calls.push({ id, name });
      items = items.map(item => item.id === id ? { ...item, name } : item);
      return structuredClone(items);
    },
  };
  const clipboard = { writeText: async text => { exports.push(text); } };
  const install = new Function("Blockly", "desktop", "document", "window", "requestAnimationFrame", "DOMPoint", "navigator", "validateComponentImport", "installComponentPreviews", "loadOfficialModule", source + "; return installComponents;")(
    { FlyoutButton, ToolboxCategory, dialog: { prompt: () => assert.fail("rename opened a dialog") } },
    false, document, dom.window, callback => { callback(); return 1; },
    class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } },
    { clipboard },
    JSON.parse,
    () => ({layout() {}, dispose() {}}),
    loadOfficialModule,
  );
  const components = install(workspace, () => [], () => 100, text => notices.push(text), backend);
  t.after(() => components.dispose());
  callbacks.get("MOLIGOD_COMPONENTS")();
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  return {
    components, backend, calls, notices, document, settle, buttons, exports, clipboard, removals,
    dialog: () => host.querySelector("dialog"),
    deleteDialog: () => host.querySelector(".auto-component-delete-dialog"),
    openDelete(index = 0) { svg.querySelectorAll(".auto-component-delete")[index].dispatchEvent(new Event("click", {bubbles:true})); },
    async confirmDelete() {
      this.deleteDialog().querySelector("form").dispatchEvent(new Event("submit", {cancelable:true}));
      await settle();
    },
    openImport() { svg.querySelector(".auto-component-import").dispatchEvent(new Event("click", {bubbles:true})); },
    async importCode(text) {
      this.openImport();
      const dialog = this.dialog();
      dialog.querySelector("textarea").value = text;
      dialog.querySelector("form").dispatchEvent(new Event("submit", {cancelable:true}));
      await settle();
    },
    async exportItem(index = 0, keyboard = false) {
      const button = svg.querySelectorAll(".auto-component-export")[index];
      button.dispatchEvent(keyboard ? new KeyboardEvent("keydown", {key:"Enter",bubbles:true,cancelable:true}) : new Event("click", {bubbles:true}));
      await settle();
    },
    names: () => items.map(item => item.name),
    lock: () => { readOnly = true; components.cancelEdit(); },
    unlock: () => { readOnly = false; },
    input: () => svg.querySelector("input"),
    handle: () => svg.querySelector(".auto-component-handle"),
    open() { this.handle().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return this.input(); },
    key(key, options = {}) { this.input().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options })); },
    blur() { this.input().dispatchEvent(new Event("blur")); },
  };
}

test("component names edit in the title row and Enter saves once with keyboard focus restored", async t => {
  const view = await fixture(t);
  const input = view.open();
  assert.equal(input.value, "原组件");
  assert.equal(view.document.activeElement, input);
  assert.equal(input.selectionStart, 0);
  assert.equal(input.selectionEnd, input.value.length);
  for (const key of ["x", "y", "width", "height"])
    assert.equal(input.parentElement.getAttribute(key), view.handle().getAttribute(key));
  input.value = "  新组件名称  ";
  view.key("Enter");
  await view.settle();
  assert.deepEqual(view.calls, [{ id: "first", name: "新组件名称" }]);
  assert.deepEqual(view.names(), ["新组件名称", "第二个组件"]);
  assert.equal(view.input(), null);
  assert.equal(view.document.activeElement, view.handle());
});

test("component deletion uses a dark modal with safe focus and deletes only after confirmation", async t => {
  const view = await fixture(t);
  view.openDelete();
  const dialog = view.deleteDialog();
  assert.equal(dialog.open, true);
  assert.equal(view.document.activeElement, dialog.querySelector('button[type="button"]'));
  assert.match(dialog.querySelector(".auto-component-delete-message").textContent, /原组件/);
  assert.deepEqual(view.removals, []);
  dialog.querySelector('button[type="button"]').click();
  assert.deepEqual(view.names(), ["原组件", "第二个组件"]);
  view.openDelete(1);
  await view.confirmDelete();
  assert.deepEqual(view.removals, ["second"]);
  assert.deepEqual(view.names(), ["原组件"]);
  assert.equal(dialog.open, false);
  assert.equal(view.document.activeElement, view.document.querySelector(".auto-component-import"));
});

test("delete confirmation renders names as text, supports retry, and closes when running or disposed", async t => {
  const view = await fixture(t);
  const unsafeName = '<img src=x onerror="alert(1)">';
  view.open().value = unsafeName;
  view.key("Enter");
  await view.settle();
  view.openDelete();
  const dialog = view.deleteDialog();
  assert.equal(dialog.querySelector("img"), null);
  assert.equal(dialog.querySelector(".auto-component-delete-message").textContent, `确定删除组件“${unsafeName}”？`);
  const originalRemove = view.backend.remove;
  view.backend.remove = async () => { throw new Error("删除失败夹具"); };
  await view.confirmDelete();
  assert.equal(dialog.open, true);
  assert.match(dialog.querySelector(".dialog-error").textContent, /删除失败夹具/);
  assert.equal(dialog.querySelector('button[type="submit"]').disabled, false);
  assert.equal(view.names().length, 2);
  let completeDelete, attempts = 0;
  view.backend.remove = () => { attempts++; return new Promise(resolve => { completeDelete = resolve; }); };
  await view.confirmDelete();
  await view.confirmDelete();
  assert.equal(attempts, 1);
  assert.equal(dialog.querySelector('button[type="submit"]').disabled, true);
  completeDelete(await originalRemove("first"));
  await view.settle();
  assert.deepEqual(view.names(), ["第二个组件"]);
  view.openDelete();
  view.lock();
  assert.equal(dialog.open, false);
  view.openDelete();
  assert.equal(dialog.open, false);
  const other = await fixture(t);
  other.openDelete();
  other.components.dispose();
  assert.equal(other.document.querySelector(".auto-component-delete-dialog"), null);
  assert.deepEqual(other.removals, []);
});

test("running or closing the editor prevents a late official dialog from opening", async t => {
  let finish;
  let opened = 0;
  const view = await fixture(t, () => new Promise(resolve => { finish = resolve; }));
  view.document.querySelector(".auto-component-official").dispatchEvent(new view.document.defaultView.Event("click", {bubbles:true}));
  view.lock();
  view.unlock();
  finish({createOfficialComponents: () => { opened++; return {open() {}, close() {}, dispose() {}}; }});
  await view.settle();
  assert.equal(opened, 0);
});

test("component codes import through a modal and each row copies only its own component", async t => {
  const view = await fixture(t);
  const importButton = view.document.querySelector(".auto-component-import");
  const officialButton = view.document.querySelector(".auto-component-official");
  const buttonX = Number(/translate\(([^,]+),/.exec(importButton.getAttribute("transform"))[1]);
  const officialX = Number(/translate\(([^,]+),/.exec(officialButton.getAttribute("transform"))[1]);
  const right = buttonX + Number(importButton.querySelector("rect").getAttribute("width"));
  assert.equal((officialX + right) / 2, 250);
  assert.ok(officialX + Number(officialButton.querySelector("rect").getAttribute("width")) < buttonX);
  const library = { schemaVersion: 1, components: [{ id: "third", name: "导入组件", scale: 125, block: { type: "moligod_action" } }] };
  assert.equal(view.buttons.has("COMPONENT_EXPORT"), false);
  view.openImport();
  assert.equal(view.dialog().open, true);
  assert.equal(view.document.activeElement, view.dialog().querySelector("textarea"));
  await view.importCode(JSON.stringify(library));
  assert.deepEqual(view.names(), ["原组件", "第二个组件", "导入组件"]);
  assert.equal(view.notices.at(-1), "组件已导入");
  assert.equal(view.dialog().open, false);
  assert.equal(view.document.activeElement, view.document.querySelector(".auto-component-import"));
  await view.exportItem(2);
  const exported = JSON.parse(view.exports[0]);
  assert.equal(exported.schemaVersion, 1);
  assert.deepEqual(exported.components, library.components);
  assert.match(view.notices.at(-1), /动作代码已复制/);
  await view.exportItem(0, true);
  assert.equal(JSON.parse(view.exports[1]).components[0].name, "原组件");
  assert.equal(view.document.querySelectorAll('input[type="file"],a[download]').length, 0);
  const root = view.document.querySelector(".auto-component-export").parentElement;
  assert.deepEqual([...root.querySelectorAll(".auto-component-button")].map(button => button.textContent), ["导出", "展开", "删除"]);
});

test("invalid codes stay editable, cancel clears them, and running or disposal closes the modal", async t => {
  const view = await fixture(t);
  await view.importCode(" ");
  assert.match(view.dialog().querySelector(".dialog-error").textContent, /请粘贴动作代码/);
  await view.importCode("中".repeat(350000));
  assert.match(view.dialog().querySelector(".dialog-error").textContent, /超过1MiB/);
  view.backend.import = async () => { throw new Error("不支持的文件"); };
  await view.importCode("{}");
  assert.match(view.dialog().querySelector(".dialog-error").textContent, /导入失败.*不支持的文件/);
  assert.equal(view.dialog().querySelector("textarea").value, "{}");
  assert.equal(view.dialog().querySelector("textarea").getAttribute("aria-invalid"), "true");
  assert.deepEqual(view.names(), ["原组件", "第二个组件"]);
  view.dialog().querySelector('button[type="button"]').click();
  assert.equal(view.dialog().open, false);
  view.openImport();
  assert.equal(view.dialog().querySelector("textarea").value, "");
  view.lock();
  assert.equal(view.dialog().open, false);
  view.openImport();
  assert.equal(view.dialog().open, false);
  const other = await fixture(t);
  other.openImport();
  other.components.dispose();
  assert.deepEqual(other.names(), ["原组件", "第二个组件"]);
  assert.equal(other.document.querySelector("dialog"), null);
});

test("clipboard failures are reported and importing code submits only once while busy", async t => {
  const view = await fixture(t);
  view.clipboard.writeText = async () => { throw new Error("剪贴板拒绝"); };
  await view.exportItem();
  assert.match(view.notices.at(-1), /动作代码复制失败.*剪贴板拒绝/);
  let resolveImport, imports = 0;
  view.backend.import = () => { imports++; return new Promise(resolve => { resolveImport = resolve; }); };
  await view.importCode("{}");
  const submit = view.dialog().querySelector('button[type="submit"]');
  assert.equal(submit.disabled, true);
  view.dialog().querySelector("form").dispatchEvent(new view.document.defaultView.Event("submit", {cancelable:true}));
  assert.equal(imports, 1);
  resolveImport([]);
  await view.settle();
  assert.equal(view.dialog().open, false);
  assert.equal(submit.disabled, false);
});

test("Escape cancels while blur saves and an unchanged name skips saving", async t => {
  const view = await fixture(t);
  view.open().value = "取消的名称";
  view.key("Escape");
  assert.equal(view.input(), null);
  assert.deepEqual(view.calls, []);
  view.open();
  view.blur();
  assert.deepEqual(view.calls, []);
  view.open().value = "点击外部保存";
  view.blur();
  await view.settle();
  assert.deepEqual(view.names(), ["点击外部保存", "第二个组件"]);
  assert.equal(view.calls.length, 1);
});

test("invalid names remain editable and IME Enter does not submit a candidate", async t => {
  const view = await fixture(t);
  const input = view.open();
  for (const invalid of ["   ", "字".repeat(61), "名称\u007f"]) {
    input.value = invalid;
    view.key("Enter");
    assert.equal(view.input(), input);
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.deepEqual(view.calls, []);
  }
  input.value = "中文名称";
  view.key("Enter", { isComposing: true });
  assert.equal(view.input(), input);
  assert.deepEqual(view.calls, []);
  view.key("Enter");
  await view.settle();
  assert.deepEqual(view.names(), ["中文名称", "第二个组件"]);
});

test("running and disposal cancel editing, and a failed save keeps the stored name", async t => {
  const view = await fixture(t);
  view.backend.rename = async () => { throw new Error("保存失败夹具"); };
  view.open().value = "失败的名称";
  view.key("Enter");
  await view.settle();
  assert.deepEqual(view.names(), ["原组件", "第二个组件"]);
  assert.match(view.notices.at(-1), /组件重命名失败/);
  view.open().value = "运行中放弃";
  view.lock();
  assert.equal(view.input(), null);
  view.open();
  assert.equal(view.input(), null);
  const other = await fixture(t);
  other.open().value = "关闭时放弃";
  other.components.dispose();
  assert.equal(other.input(), null);
  assert.deepEqual(other.calls, []);
});
