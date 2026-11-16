import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import ts from "typescript";

const settle = () => new Promise((resolve) => setImmediate(resolve));
function source(name, exported) {
  return ts
    .transpileModule(
      readFileSync(new URL(`../src/${name}.ts`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.ES2022,
          target: ts.ScriptTarget.ES2022,
        },
      },
    )
    .outputText.replace(/^import .*?;\r?\n/gms, "")
    .replace(`export function ${exported}`, `function ${exported}`);
}
function dom(t) {
  const window = new JSDOM('<body><button id="version">0.1.0</button></body>')
    .window;
  t.after(() => window.close());
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
    this.querySelector("[autofocus]")?.focus();
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new window.Event("close"));
  };
  return window;
}

test("update check runs once and marks a release; confirmation is required before install", async (t) => {
  const window = dom(t),
    document = window.document;
  let resolveCheck,
    checks = 0;
  const installed = [];
  const init = new Function(
    "document",
    "desktop",
    "checkAppUpdate",
    "installAppUpdate",
    `${source("app-updates", "initAppUpdates")}; return initAppUpdates;`,
  )(
    document,
    true,
    () => {
      checks++;
      return new Promise((resolve) => {
        resolveCheck = resolve;
      });
    },
    async (version) => {
      installed.push(version);
      throw new Error("签名校验失败");
    },
  );
  const button = document.getElementById("version");
  init(button, "0.1.0");
  button.click();
  assert.equal(checks, 1);
  assert.match(
    document.querySelector(".github-status").textContent,
    /正在检查/,
  );
  resolveCheck({
    version: "0.2.0",
    tag: "v0.2.0",
    notes: "<img src=x onerror=alert(1)>",
  });
  await settle();
  assert.equal(button.classList.contains("has-update"), true);
  assert.match(
    document.querySelector(".github-status").textContent,
    /是否更新到最新 0.2.0/,
  );
  assert.equal(document.querySelector(".app-update-notes img"), null);
  assert.deepEqual(installed, []);
  document.querySelector(".secondary").click();
  assert.equal(document.querySelector("dialog").open, false);
  button.click();
  assert.equal(checks, 1);
  const install = document.querySelector(".app-update-install");
  install.click();
  install.click();
  await settle();
  assert.deepEqual(installed, ["0.2.0"]);
  assert.equal(install.disabled, false);
  assert.match(
    document.querySelector(".dialog-error").textContent,
    /签名校验失败/,
  );
  assert.equal(install.textContent, "重新检查");
  install.click();
  assert.equal(checks, 2);
  assert.deepEqual(installed, ["0.2.0"]);
  resolveCheck({ version: "0.3.0", tag: "v0.3.0", notes: "" });
  await settle();
  assert.match(document.querySelector(".github-status").textContent, /0.3.0/);
  assert.equal(install.textContent, "更新");
});

test("failed startup checks are quiet and clicking retries; equal versions have no badge", async (t) => {
  const window = dom(t),
    document = window.document;
  let checks = 0;
  const init = new Function(
    "document",
    "desktop",
    "checkAppUpdate",
    "installAppUpdate",
    `${source("app-updates", "initAppUpdates")}; return initAppUpdates;`,
  )(
    document,
    true,
    async () => {
      if (++checks === 1) throw new Error("无法访问官方 GitHub 仓库");
      return null;
    },
    () => assert.fail("unexpected installation"),
  );
  const button = document.getElementById("version");
  init(button, "0.1.0");
  await settle();
  assert.equal(document.querySelector("dialog").open, false);
  assert.match(button.title, /无法访问/);
  button.click();
  await settle();
  assert.equal(checks, 2);
  assert.equal(button.classList.contains("has-update"), false);
  assert.match(
    document.querySelector(".github-status").textContent,
    /当前已是最新版本/,
  );
  assert.equal(document.querySelector(".app-update-install").hidden, true);
});

test("official component dialog ignores late downloads after close and imports only on selection", async (t) => {
  const window = dom(t),
    document = window.document;
  const pending = [],
    imported = [];
  const create = new Function(
    "document",
    "officialComponentCatalog",
    "officialComponentCode",
    `${source("official-components", "createOfficialComponents")}; return createOfficialComponents;`,
  )(
    document,
    async () => ({
      schemaVersion: 1,
      components: [
        { id: "wait", name: "<script>name</script>", description: "说明" },
      ],
    }),
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const ui = create(document.body, async (code) => {
    imported.push(code);
  });
  t.after(() => ui.dispose());
  ui.open();
  await settle();
  assert.equal(document.querySelector("strong script"), null);
  assert.deepEqual(imported, []);
  document.querySelector(".official-component-row button").click();
  ui.close();
  pending.shift()("late-code");
  await settle();
  assert.deepEqual(imported, []);
  ui.open();
  await settle();
  document.querySelector(".official-component-row button").click();
  pending.shift()("valid-code");
  await settle();
  assert.deepEqual(imported, ["valid-code"]);
  assert.match(document.querySelector(".github-status").textContent, /已导入/);
});

test("official repository failures can be retried and disposed fetches leave the UI closed", async (t) => {
  const window = dom(t),
    document = window.document;
  let attempts = 0,
    finish;
  const create = new Function(
    "document",
    "officialComponentCatalog",
    "officialComponentCode",
    `${source("official-components", "createOfficialComponents")}; return createOfficialComponents;`,
  )(
    document,
    async () => {
      if (++attempts === 1) throw new Error("无法访问官方 GitHub 仓库");
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    () => assert.fail("unexpected download"),
  );
  const ui = create(document.body, () => assert.fail("unexpected import"));
  ui.open();
  await settle();
  assert.match(
    document.querySelector(".dialog-error").textContent,
    /无法访问官方 GitHub 仓库/,
  );
  document.querySelector(".github-retry").click();
  ui.dispose();
  finish({ schemaVersion: 1, components: [] });
  await settle();
  assert.equal(document.querySelector("dialog"), null);
});
