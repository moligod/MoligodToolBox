import { test } from "node:test";
import assert from "node:assert/strict";
import { initCatalog } from "../src/catalog.ts";

test("catalog filters do not attach navigation to existing action rows or their parameter inputs", () => {
  let page = "automation";
  const elements = [];
  function element(tag, id, dataset = {}, parent) {
    const listeners = new Map();
    const classes = new Set();
    const el = {
      tagName: tag.toUpperCase(),
      id,
      dataset,
      parent,
      value: "",
      hidden: false,
      textContent: "",
      classList: {
        add: (s) => classes.add(s),
        remove: (s) => classes.delete(s),
        toggle: (s, active) => (active ? classes.add(s) : classes.delete(s)),
      },
      setAttribute() {},
      addEventListener: (type, listener) => {
        const list = listeners.get(type) ?? [];
        list.push(listener);
        listeners.set(type, list);
      },
      fire(type) {
        for (let at = el; at; at = at.parent) at.dispatch(type);
      },
      dispatch(type) {
        for (const listener of listeners.get(type) ?? [])
          listener({ preventDefault() {} });
      },
      click() {
        el.fire("click");
      },
    };
    elements.push(el);
    return el;
  }
  const tools = element("button", "tools", { page: "tools" });
  tools.addEventListener("click", () => (page = "tools"));
  const category = element("button", "general", { category: "general" });
  const comment = element("div", "row", { category: "comment" });
  const input = element("input", "parameter", {}, comment);
  element("input", "search-input");
  element("form", "tool-search");
  element("div", "card", {
    toolCategory: "general",
    toolStatus: "ready",
    search: "automation",
  });
  for (const id of [
    "result-count",
    "empty-results",
    "catalog-title",
    "clear-filters",
    "tool-results",
  ])
    element("div", id);
  function matches(el, selector) {
    const tag = selector.match(/^[a-z]+/)?.[0];
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    const attr = selector.match(/\[data-([\w-]+)(?:="([^"]+)")?\]/);
    if (!attr) return false;
    const key = attr[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return (
      key in el.dataset &&
      (attr[2] === undefined || el.dataset[key] === attr[2])
    );
  }
  const previous = globalThis.document;
  globalThis.document = {
    querySelectorAll: (selector) =>
      elements.filter((el) => matches(el, selector)),
    querySelector: (selector) =>
      selector.startsWith("#")
        ? elements.find((el) => el.id === selector.slice(1))
        : elements.find((el) => matches(el, selector)),
  };
  try {
    initCatalog();
    input.click();
    assert.equal(
      page,
      "automation",
      "parameter clicks must not navigate or apply action categories as catalog filters",
    );
    assert.equal(elements.find((el) => el.id === "card").hidden, false);
    category.click();
    assert.equal(page, "tools", "real catalog controls must keep working");
    assert.equal(
      elements.find((el) => el.id === "result-count").textContent,
      "1 个工具",
    );
  } finally {
    globalThis.document = previous;
  }
});
