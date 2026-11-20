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
const { initAutomationTasks } = await import(
  "data:text/javascript;base64," +
    Buffer.from(
      "import { taskDrag } from " +
        JSON.stringify(
          new URL("../src/automation-task-drag.ts", import.meta.url).href,
        ) +
        ';\nconst automationPhases = { idle: "未运行" };\n' +
        source,
    ).toString("base64")
);

function setup() {
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
        this.children = [
          ...nodes,
          ...this.children.filter((n) => !nodes.includes(n)),
        ];
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
      getAttribute() {
        return null;
      },
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
  const root = element();
  root.append(...elements.values());
  elements
    .get("auto-task-create")
    .append(elements.get("auto-task-new"), elements.get("auto-import"));
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
  return elements;
}

for (const scenario of [
  "unchanged",
  "edited",
  "closed",
  "reopened",
  "replaced",
])
  test(`first save handles the ${scenario} draft`, async () => {
    const elements = setup();
    let canvas = {
      schemaVersion: 1,
      name: "任务",
      steps: [{ action: { type: "wait", ms: 1 } }],
    };
    const renders = [];
    let finishSave;
    const saved = [];
    const manager = initAutomationTasks(
      {
        read: () => structuredClone(canvas),
        exportScript() {},
        bindings: () => ({}),
        visible: () => true,
        selection() {},
        highlight() {},
        render: (script) => {
          renders.push(script);
          canvas = structuredClone(script);
        },
        notify: (text, error) => {
          if (error) assert.fail(text);
        },
      },
      {
        available: true,
        async action(action, data) {
          if (action === "task-save") {
            saved.push(data);
            await new Promise((resolve) => {
              finishSave = resolve;
            });
          }
          if (action === "task-list")
            return saved.map((task) => ({
              id: task.id,
              name: task.name,
              intervalMs: task.intervalMs,
            }));
          if (action === "task-load")
            return saved.find((task) => task.id === data);
          if (action === "task-statuses") return {};
        },
      },
    );
    manager.importScript(canvas);
    elements.get("auto-task-name").value = "任务";
    renders.length = 0;
    elements
      .get("auto-task-list")
      .querySelectorAll("button")
      .find((b) => b.dataset.taskId === "" && b.dataset.taskAction === "save")
      .listeners.click();
    for (let i = 0; i < 5 && !finishSave; i++)
      await new Promise((resolve) => setImmediate(resolve));
    assert.equal(saved.length, 1);
    if (scenario !== "unchanged") {
      canvas.steps.push({ action: { type: "wait", ms: 2 } });
      elements.get("auto-task-name").value = "任务（改）";
    }
    if (scenario === "closed" || scenario === "reopened")
      manager.clearSelection();
    if (scenario === "reopened") await manager.refresh(true);
    if (scenario === "replaced") {
      manager.importScript({ ...canvas, name: "另一任务", steps: [] });
    }
    finishSave();
    for (let i = 0; i < 5; i++)
      await new Promise((resolve) => setImmediate(resolve));
    if (scenario === "replaced") {
      assert.equal(manager.selectedId(), "");
      assert.equal(canvas.name, "另一任务");
      return;
    }
    if (scenario === "closed" || scenario === "reopened") {
      await manager.refresh(true);
      assert.equal(manager.selectedId(), saved[0].id);
      assert.equal(canvas.steps.length, 2);
      assert.equal(elements.get("auto-task-name").value, "任务（改）");
      assert.equal(
        elements
          .get("auto-task-list")
          .querySelectorAll("button")
          .some(
            (button) =>
              button.dataset.taskId === "" &&
              button.dataset.taskAction === "save",
          ),
        false,
      );
      return;
    }
    assert.equal(manager.selectedId(), saved[0].id);
    if (scenario === "edited") {
      // The stale submitted snapshot never replaces the canvas or the name being edited.
      assert.deepEqual(renders, []);
      assert.equal(canvas.steps.length, 2);
      assert.equal(elements.get("auto-task-name").value, "任务（改）");
    } else {
      assert.equal(renders.length, 1);
      assert.equal(renders[0].steps.length, 1);
    }
  });
