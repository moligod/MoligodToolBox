import { setToolboxExpanded, toolWindowPage, openToolWindow } from "./api";
import { workspaceTabs } from "./workspace-tabs.ts";

const tabs = workspaceTabs();
const titles: Record<string, string> = {
  tools: "游戏工具箱",
  settings: "设置",
  delta: "三角洲行动",
  crosshair: "自定义准星",
  automation: "自动化助手",
  games: "发现游戏",
  "game-detail": "游戏详情",
};
const section = (page: string) =>
  document.getElementById(
    ["crosshair", "automation"].includes(page)
      ? page + "-dialog"
      : "page-" + page,
  );

function renderTabs() {
  const strip = document.getElementById("workspace-tabs")!;
  strip.replaceChildren();
  for (const page of tabs.opened()) {
    const group = document.createElement("div");
    group.className = "workspace-tab";
    group.classList.toggle("selected", tabs.current() === page);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = titles[page];
    button.id = "tab-" + page;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", page + "-dialog");
    button.setAttribute("aria-selected", String(tabs.current() === page));
    button.tabIndex =
      tabs.current() === page ||
      (!tabs.opened().includes(tabs.current()) && tabs.opened()[0] === page)
        ? 0
        : -1;
    button.addEventListener("click", () => showPage(page));
    button.addEventListener("keydown", (event) => {
      const opened = tabs.opened();
      const index = opened.indexOf(page);
      let next: string | undefined;
      if (event.key === "ArrowRight")
        next = opened[(index + 1) % opened.length];
      if (event.key === "ArrowLeft")
        next = opened[(index - 1 + opened.length) % opened.length];
      if (event.key === "Home") next = opened[0];
      if (event.key === "End") next = opened[opened.length - 1];
      if (event.key === "Delete") {
        event.preventDefault();
        closeTab(page);
        return;
      }
      if (next) {
        event.preventDefault();
        showPage(next);
        document.getElementById("tab-" + next)?.focus();
      }
    });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "workspace-tab-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "关闭" + titles[page] + "标签");
    close.addEventListener("click", () => closeTab(page));
    group.append(button, close);
    strip.append(group);
  }
  const home = document.getElementById("workspace-home")!;
  home.classList.toggle("selected", tabs.current() === "tools");
  home.setAttribute("aria-pressed", String(tabs.current() === "tools"));
  document.getElementById("return-toolbox")!.hidden =
    tabs.current() === "tools";
}

function closeTab(page: string) {
  if (!tabs.close(page)) return;
  section(page)?.dispatchEvent(new Event("close"));
  showPage(tabs.current());
}

/** Tool windows hide instead of closing, so mirror hide/show as the page close/activate
 * lifecycle: hiding releases idle native modules, showing reopens them on demand. */
export function setToolPageVisible(page: string, visible: boolean) {
  const target = section(page);
  if (!target || target.hidden !== visible) return;
  if (visible) {
    showPage(page);
    return;
  }
  target.hidden = true;
  target.dispatchEvent(new Event("close"));
}

export function initNavigation() {
  document
    .getElementById("workspace-home")!
    .addEventListener("click", () => showPage("tools"));
  document
    .getElementById("return-toolbox")!
    .addEventListener("click", () => showPage("tools"));
  renderTabs();
}

export function showPage(page: string) {
  if (["crosshair", "automation"].includes(page) && page !== toolWindowPage) {
    void openToolWindow(page).catch(error => {
      const notice = document.getElementById("notice")!;
      notice.textContent = "打开窗口失败：" + String(error);
      notice.showPopover();
    });
    return;
  }
  if (toolWindowPage && page !== toolWindowPage) return;
  if (page === "games") page = "tools";
  const target = section(page);
  if (!target) return;
  const expanded = page !== "tools";
  document.body.classList.toggle("toolbox-compact", !expanded);
  document.getElementById("return-list")!.hidden = !expanded;
  if (!toolWindowPage) void setToolboxExpanded(expanded).catch(error => {
    const notice = document.getElementById("notice")!;
    notice.textContent = "调整窗口失败：" + String(error);
    notice.showPopover();
  });
  const entering = target.hidden;
  tabs.select(page);
  document.querySelectorAll<HTMLElement>(".page").forEach((section) => {
    const leaving = !section.hidden && section !== target;
    section.hidden = section !== target;
    if (leaving && section.classList.contains("tool-page"))
      section.dispatchEvent(new Event("deactivate"));
  });
  document.querySelectorAll<HTMLElement>("[data-page]").forEach((button) => {
    const active =
      button.dataset.page === page ||
      (button.dataset.page === "games" && page === "game-detail") ||
      (button.dataset.page === "tools" &&
        (page === "crosshair" || page === "automation"));
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  renderTabs();
  const isGamePage = ["games", "game-detail"].includes(page);
  if (isGamePage)
    document
      .querySelectorAll<HTMLElement>("button[data-category]")
      .forEach((button) => {
        button.classList.remove("active");
        button.setAttribute("aria-pressed", "false");
      });
  document.querySelector<HTMLElement>(".topbar")!.hidden = isGamePage;
  const search = document.querySelector<HTMLInputElement>("#search-input")!;
  search.placeholder = isGamePage
    ? "搜索游戏、标签、开发商"
    : "搜索工具名称、功能";
  search.setAttribute("aria-label", isGamePage ? "搜索游戏" : "搜索工具");
  document.dispatchEvent(new CustomEvent("pagechange", { detail: page }));
  if (entering && target.classList.contains("tool-page"))
    target.dispatchEvent(new Event("activate"));
  document.querySelector("main")!.scrollTop = 0;
  const heading = target.querySelector<HTMLElement>("h1,h2");
  heading?.setAttribute("tabindex", "-1");
  heading?.focus({ preventScroll: true });
}
