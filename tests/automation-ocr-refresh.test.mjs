import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/automation-editor.ts", import.meta.url),
  "utf8",
);
const tree = ts.createSourceFile(
  "editor.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
let callback;
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(tree) === 'get("auto-ocr-test").addEventListener'
  )
    callback = node.arguments[1].getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(callback);
const js = ts.transpileModule(`const handler = (${callback});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const factory = new Function(
  "task",
  "editing",
  "state",
  "previewGeneration",
  "get",
  "ocrResult",
  "mousePreview",
  "request",
  `${js}
return handler;`,
);

function harness(reply) {
  let pending,
    current = "frame-A";
  const ocrResult = { textContent: "" };
  const button = { disabled: false };
  const owner = { step: { action: { type: "ocr" } } };
  const preview = {
    selection: () => ({
      snapshot: current,
      region: { x: 0, y: 0, width: 10, height: 10 },
    }),
    current: () => current,
  };
  const click = factory(
    (work) => {
      pending = work();
    },
    owner,
    { running: false },
    0,
    () => button,
    ocrResult,
    preview,
    reply,
  );
  return {
    click,
    ocrResult,
    refresh: (next) => {
      current = next;
      ocrResult.textContent = "";
    },
    done: () => pending,
  };
}

test("OCR reply for the displayed frame is shown", async () => {
  const h = harness(async () => ({ text: "A" }));
  h.click();
  await h.done();
  assert.equal(h.ocrResult.textContent, "A");
});

test("late OCR reply or failure for a replaced screenshot is dropped", async () => {
  for (const fails of [false, true]) {
    let finish;
    const h = harness(
      () =>
        new Promise((resolve, reject) => {
          finish = () =>
            fails ? reject(new Error("boom")) : resolve({ text: "A" });
        }),
    );
    h.click();
    h.refresh("frame-B");
    finish();
    await h.done();
    assert.equal(h.ocrResult.textContent, "");
  }
});

test("refreshing the inline screenshot invalidates before the new capture starts", async () => {
  const { createMousePreview } =
    await import("../src/automation-mouse-preview.ts");
  const oldDocument = globalThis.document,
    oldImage = globalThis.Image;
  const ctx = { drawImage() {}, strokeRect() {} };
  const element = () => ({
    children: [],
    append(...items) {
      this.children.push(...items);
    },
    insertBefore(item) {
      this.children.push(item);
    },
    querySelector() {
      return null;
    },
    setAttribute() {},
    addEventListener() {},
    getContext() {
      return ctx;
    },
  });
  globalThis.document = { createElement: element };
  globalThis.Image = class {
    naturalWidth = 64;
    naturalHeight = 48;
    async decode() {}
  };
  try {
    const step = {
      delayMs: 0,
      action: { type: "ocr", region: { x: 1, y: 1, width: 4, height: 4 } },
    };
    const events = [];
    let frames = 0;
    const preview = createMousePreview(element(), {
      owner: () => step,
      locked: () => false,
      update() {},
      invalidate: () => events.push(["invalidate", preview.current()]),
      capture: async () => {
        events.push(["capture"]);
        return {
          width: 64,
          height: 48,
          scale: 100,
          snapshot: `frame-${++frames}`,
          png: "mock",
        };
      },
    });
    await preview.load();
    assert.equal(preview.current(), "frame-1");
    await preview.load();
    assert.equal(preview.current(), "frame-2");
    // The old frame is gone before invalidation runs, and invalidation precedes each capture.
    assert.deepEqual(events, [
      ["invalidate", undefined],
      ["capture"],
      ["invalidate", undefined],
      ["capture"],
    ]);
  } finally {
    globalThis.document = oldDocument;
    globalThis.Image = oldImage;
  }
});
