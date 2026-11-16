import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = ts
  .transpileModule(
    readFileSync(
      new URL("../src/automation-tasks.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    },
  )
  .outputText.replace(/^import .*?;\n/gms, "");
const { initAutomationTasks, moveTaskRows } = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      'import { taskDrag } from ' + JSON.stringify(new URL("../src/automation-task-drag.ts", import.meta.url).href) + ';\nconst automationPhases = { idle: "未运行" };\n' + source,
    ).toString("base64")
);

test("task reorder moves in both directions without changing row data", () => {
  const rows = [{id:"a",name:"A"},{id:"b",name:"B"},{id:"c",name:"C"}];
  assert.deepEqual(moveTaskRows(rows,"a","c",true).map(row=>row.id),["b","c","a"]);
  assert.deepEqual(moveTaskRows(rows,"c","a",false).map(row=>row.id),["c","a","b"]);
  assert.equal(moveTaskRows(rows,"missing","a",false),rows);
  assert.equal(moveTaskRows(rows,"b","b",true),rows);
  assert.equal(moveTaskRows(rows,"a","c",true)[2],rows[0]);
});

for (const toolbar of [false, true]) test(`task actions preserve selected drafts with toolbar=${toolbar}`, async () => {
  const elements = new Map();
  function element(id = "") {
    const el = {
      id,
      value: "",
      dataset: {},
      children: [],
      scrollTop: 0,
      offsetHeight: 40,
      style: {},
      listeners: {},
      classList: { toggle() {} },
      append(...nodes) {
        for (const n of nodes) {
          if (typeof n === "string") continue;
          if (n.parent)
            n.parent.children = n.parent.children.filter((x) => x !== n);
          n.parent = this;
          this.children.push(n);
        }
      },
      replaceChildren(...nodes) {
        for (const child of this.children) child.parent = null;
        this.children = [];
        this.append(...nodes);
      },
      prepend(...nodes) {
        this.append(...nodes);
        this.children = [...nodes, ...this.children.filter(n => !nodes.includes(n))];
      },
      contains() {
        return false;
      },
      querySelectorAll(selector) {
        const all = this.children.flatMap((n) => [
          n,
          ...n.querySelectorAll(selector),
        ]);
        return selector === "button"
          ? all.filter((n) => n.type === "button")
          : [];
      },
      setAttribute() {},
      addEventListener(type, fn) {
        this.listeners[type] = fn;
      },
      focus() {},
    };
    if (id) elements.set(id, el);
    return el;
  }
  for (const id of [
    "auto-task-name",
    "auto-task-interval",
    "auto-task-list",
    "auto-task-create",
    "auto-task-fields-home",
    "auto-task-fields",
    "auto-task-new",
    "auto-import",
    "auto-task-loop",
    "auto-task-repeats",
  ])
    element(id);
  if (toolbar) element("auto-current-task");
  elements.get("auto-task-name").value = "当前草稿";
  elements.get("auto-task-interval").value = "1000";
  const root = element();
  root.append(...elements.values());
  elements.get("auto-task-create").append(elements.get("auto-task-new"), elements.get("auto-import"));
  elements
    .get("auto-task-fields-home")
    .append(elements.get("auto-task-fields"));
  elements
    .get("auto-task-fields")
    .append(elements.get("auto-task-name"), elements.get("auto-task-interval"));
  globalThis.document = {
    getElementById: (id) => {
      const found = elements.get(id);
      let parent = found;
      while (parent && parent !== root) parent = parent.parent;
      return parent === root ? found : null;
    },
    createElement: () => element(),
    createTextNode: () => element(),
    activeElement: null,
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const script = { schemaVersion: 1, name: "当前草稿", steps: [] };
  const saved = {
    schemaVersion: 2,
    id: "other",
    name: "另一个任务",
    intervalMs: 2300,
    script: { ...script, name: "另一个任务" },
  };
  const calls = [];
  const exports = [];
  const errors = [];
  let exists = true;
  let running = false;
  let oldEngine = true;
  let rendered = 0;
  let result, listener;
  let active = true;
  let hasTasks;
  const manager = initAutomationTasks(
    {
      read: () => script,
      exportScript: (value) => exports.push(value),
      render: () => rendered++,
      bindings: () => ({}),
      notify: (text, error) => {
        if (error) errors.push(text);
      },
      visible: () => true,
      selection: (value, availableTasks) => {
        // The real editor updates import availability from this callback.
        document.getElementById("auto-import").disabled = running;
        active = value;
        hasTasks = availableTasks;
      },
      highlight(value) {
        result = value;
      },
    },
    {
      available: true,
      async subscribe(callback) {
        listener = callback;
        return () => {};
      },
      async action(action, data) {
        calls.push([action, data]);
        if (action === "task-save" && oldEngine) throw new Error("unknown field `loop`");
        if (action === "release") oldEngine = false;
        if (action === "task-list") return exists ? [saved] : [];
        if (action === "task-statuses")
          return {
            other: {
              running,
              phase: "idle",
              executed: 0,
              variables: {},
              logs: [],
            },
          };
        if (action === "task-start") running = true;
        if (action === "task-load") return saved;
        if (action === "task-delete") exists = false;
      },
    },
  );
  assert.equal(hasTasks, false);
  assert.deepEqual(elements.get("auto-task-list").children, [elements.get("auto-task-create")],
    "empty list shows the creation card without a placeholder pushing it below the viewport");
  await manager.refresh();
  assert.equal(hasTasks, true);
  assert.equal(active, false);
  assert.equal(rendered, 0);
  assert.equal(elements.get("auto-task-list").children.length, 2);
  assert.ok(!calls.some(([action]) => action === "task-load"));
  assert.ok(
    !elements
      .get("auto-task-list")
      .children[0].children[0].textContent.includes("未运行"),
  );
  await manager.refresh(true);
  assert.equal(active, true);
  assert.equal(elements.get("auto-task-name").value, saved.name);
  assert.equal(rendered, 1);
  elements.get("auto-task-new").listeners.click();
  assert.equal(active, true);
  assert.equal(elements.get("auto-task-name").value, "新任务");
  assert.equal(elements.get("auto-task-interval").value, "1000");
  assert.equal(elements.get("auto-task-interval").disabled, true);
  assert.ok(elements.get("auto-task-list").querySelectorAll("button").some(button => button.dataset.taskId === "" && button.dataset.taskAction === "reorder"), "unsaved task must have a reorder handle");
  const draftHandle = () => elements.get("auto-task-list").querySelectorAll("button").find(button => button.dataset.taskId === "" && button.dataset.taskAction === "reorder");
  draftHandle().listeners.keydown({key:"ArrowDown",preventDefault(){}});
  assert.deepEqual(elements.get("auto-task-list").children.filter(row=>row.dataset.taskId !== undefined).map(row=>row.dataset.taskId),["other",""]);
  await manager.refresh();
  assert.deepEqual(elements.get("auto-task-list").children.filter(row=>row.dataset.taskId !== undefined).map(row=>row.dataset.taskId),["other",""]);
  draftHandle().listeners.keydown({key:"ArrowUp",preventDefault(){}});
  assert.deepEqual(elements.get("auto-task-list").children.filter(row=>row.dataset.taskId !== undefined).map(row=>row.dataset.taskId),["","other"]);
  elements.get("auto-task-repeats").value = "0";
  elements.get("auto-task-repeats").listeners.input();
  assert.equal(elements.get("auto-task-interval").disabled, false);
  elements.get("auto-task-repeats").value = "3";
  elements.get("auto-task-repeats").listeners.input();
  elements.get("auto-task-name").value = "当前草稿";
  rendered = 0;
  function buttons() {
    return [...elements.get("auto-task-list").querySelectorAll("button"),
      ...(elements.get("auto-current-task")?.querySelectorAll("button") ?? [])];
  }
  if (toolbar) assert.equal(elements.get("auto-task-fields").parent, elements.get("auto-current-task"));
  for (const id of ["", "other"])
    assert.deepEqual(
      buttons()
        .filter(
          (b) => b.dataset.taskId === id && !["select", "reorder"].includes(b.dataset.taskAction),
        )
        .map((b) => b.dataset.taskAction).sort(),
      ["export", "save", "delete", "run"].sort(),
    );
  assert.equal(
    buttons().find(
      (b) => b.dataset.taskId === "" && b.dataset.taskAction === "run",
    ).disabled,
    true,
  );
  async function click(key) {
    buttons()
      .find((b) => b.dataset.taskId === "other" && b.dataset.taskAction === key)
      .listeners.click();
    await new Promise((resolve) => setImmediate(resolve));
  }
  const otherRow = elements.get("auto-task-list").children.find(row => row.dataset.taskId === "other");
  if (!toolbar) {
  const otherFields = otherRow.children.find(child => child.className === "auto-task-controls");
  const otherActions = otherRow.children.find(child => child.className === "auto-task-actions");
  const otherName = otherFields.children[0], otherInterval = otherFields.children[2];
  const otherRepeat = otherActions.children[0].children[0];
  otherName.value = "修改后的任务"; otherName.listeners.input();
  otherRepeat.value = "4"; otherRepeat.listeners.input();
  otherInterval.value = "2800"; otherInterval.listeners.input();
  } else {
    assert.ok(otherRow.children.some(child => child.className === "auto-task-select"));
    assert.ok(!otherRow.children.some(child => child.className === "auto-task-controls"));
    otherRow.listeners.click({target:{closest:selector => selector.includes("details") ? {} : null}});
    assert.equal(manager.selectedId(), "", "opening another task's menu must not switch the active draft");
  }
  await click("export");
  assert.equal(exports[0].name, toolbar ? saved.name : "修改后的任务");
  assert.equal(exports[0].repeats, toolbar ? 1 : 4);
  assert.equal(rendered, 0);
  buttons()
    .find((b) => b.dataset.taskId === "" && b.dataset.taskAction === "export")
    .listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(exports[1].name, "当前草稿");
  assert.equal(exports[1].schemaVersion, 1);
  assert.equal(exports[1].repeats, 3);
  assert.equal(elements.get("auto-task-name").value, "当前草稿");
  await click("save");
  assert.equal(calls.filter(([action]) => action === "task-save").length, 2);
  assert.ok(calls.some(([action]) => action === "release"));
  assert.ok(calls.some(([action]) => action === "open"));
  assert.deepEqual(calls.filter(([action]) => action === "task-save")[0][1], calls.filter(([action]) => action === "task-save")[1][1]);
  const payload = calls.find(([action]) => action === "task-save")[1];
  assert.equal(payload.id, "other");
  assert.equal(payload.name, toolbar ? saved.name : "修改后的任务");
  assert.equal(payload.intervalMs, toolbar ? 2300 : 2800);
  assert.equal(payload.repeatCount, toolbar ? 1 : 4);
  assert.deepEqual(payload.script.steps, saved.script.steps);
  await click("run");
  assert.equal(
    calls.find(([action]) => action === "task-start")[1].id,
    "other",
  );
  assert.equal(
    buttons().find(
      (b) => b.dataset.taskId === "other" && b.dataset.taskAction === "stop",
    ).disabled,
    false,
  );
  await click("stop");
  assert.equal(calls.find(([action]) => action === "task-stop")[1], "other");
  await click("delete");
  assert.equal(calls.find(([action]) => action === "task-delete")[1], "other");
  assert.equal(elements.get("auto-task-name").value, "当前草稿");
  assert.equal(rendered, 0);
  assert.deepEqual(errors, []);
  exists = true;
  await manager.refresh();
  elements.get("auto-task-list").children
    .find(row => row.dataset.taskId === "other")
    .listeners.click({target:{closest:()=>null}});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(manager.showResults(), true);
  const update = {
    running: true,
    phase: "running",
    executed: 4,
    variables: { text: "识别结果" },
    logs: ["第4步完成"],
  };
  listener({ taskId: "other", status: update });
  assert.equal(result, update);
  listener({ taskId: "unselected", status: { ...update, executed: 9 } });
  assert.equal(result, update);
  elements.get("auto-task-new").listeners.click();
  assert.equal(result, undefined);
  assert.equal(manager.showResults(), false);
  elements.get("auto-task-name").value = "关闭前的草稿";
  manager.clearSelection();
  assert.equal(active, false);
  assert.equal(manager.showResults(), false);
  assert.equal(result, undefined);
  await manager.refresh();
  assert.equal(active, false);
  elements.get("auto-task-list").children
    .find(row => row.dataset.taskId === "")
    .listeners.click({target:{closest:()=>null}});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(active, true);
  assert.equal(elements.get("auto-task-name").value, "关闭前的草稿");
  delete globalThis.document;
  delete globalThis.window;
});
