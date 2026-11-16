import { initNavigation, showPage } from "./navigation";
import {
  desktop,
  toolWindowPage,
  load,
  save,
  controlWindow,
  startWindowDrag,
  openDeltaGuide,
  openWebsite,
  type WindowAction,
  type Config,
} from "./api";

import { initCatalog } from "./catalog";
import { initToolboxShell } from "./toolbox-shell";
import { initAutomationEditor } from "./automation-editor";
import { initCrosshairEditor } from "./crosshair-editor";
import { configAutosave } from "./config-autosave";
import { bindModalTitlebarDrag } from "./modal-titlebar-drag";
import { initAppUpdates } from "./app-updates";

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error("Missing element: " + id);
  return el as T;
}
const notice = element("notice");
function notify(message: string, error = false) {
  if (!message) return;
  const toast = document.createElement("button");
  toast.type = "button";
  toast.className = error ? "toast error" : "toast";
  toast.textContent = message;
  toast.setAttribute("role", error ? "alert" : "status");
  toast.title = "点击关闭";
  const close = () => {
    toast.remove();
    if (!notice.children.length) notice.hidePopover();
  };
  toast.onclick = close;
  notice.append(toast);
  if (notice.children.length > 3) notice.firstElementChild?.remove();
  notice.showPopover();
  setTimeout(close, error ? 8000 : 4000);
}
function failure(error: unknown) {
  notify(error instanceof Error ? error.message : String(error), true);
}

if (desktop) bindModalTitlebarDrag(document, () => void startWindowDrag().catch(failure));

document
  .querySelectorAll<HTMLButtonElement>("[data-window-action]")
  .forEach((button) => {
    button.disabled = !desktop;
    if (!desktop) button.title = "仅桌面客户端可用";
    button.addEventListener("click", () => {
      void controlWindow(button.dataset.windowAction as WindowAction).catch(
        failure,
      );
    });
  });

const settings = configAutosave(
  (config) => (desktop ? save(config) : Promise.resolve(config)),
  failure,
);

function syncControls() {
  const config = settings.current();
  element<HTMLButtonElement>("open-crosshair").disabled = !config;
}
function renderConfig() {
  const config = settings.current();
  if (!config) return;
  syncControls();
}
function persist(patch: Partial<Config>) {
  if (settings.update(patch)) {
    renderConfig();
    crosshairEditor?.refresh();
  }
}

document.querySelectorAll<HTMLElement>("[data-page]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showPage(button.dataset.page!);
  });
});
document.querySelector(".brand")?.addEventListener("click", (event) => {
  event.preventDefault();
  showPage("games");
});
element("open-delta-guide").addEventListener("click", (event) => {
  if (!desktop) return; // Browser preview uses the ordinary HTTPS link.
  event.preventDefault();
  void openDeltaGuide().catch(failure);
});
document.querySelectorAll<HTMLAnchorElement>("[data-website]").forEach(link => {
  link.addEventListener("click", event => {
    if (!desktop) return;
    event.preventDefault();
    void openWebsite(link.dataset.website!).catch(failure);
  });
});
const crosshairEditor = toolWindowPage === "crosshair" ? initCrosshairEditor({
  getConfig: settings.current,
  save: (crosshair) => persist({ crosshair }),
  notify,
}) : undefined;
const automationEditor = toolWindowPage === "automation" ? initAutomationEditor(notify) : undefined;
initNavigation();
initCatalog();
if (toolWindowPage) {
  document.body.classList.add("tool-window");
  document.body.classList.remove("toolbox-compact");
  const title = { crosshair: "自定义准星", automation: "自动化助手" }[toolWindowPage];
  document.querySelector(".brand strong")!.textContent = title ?? "moligod";
} else {
  initToolboxShell(failure);
  showPage("tools");
}
syncControls();
void load()
  .then((result) => {
    element("app-version").textContent = result.version;
    if (!toolWindowPage) initAppUpdates(element<HTMLButtonElement>("app-version"), result.version);
    settings.initialize(result.config);
    automationEditor?.setInstalled(
      result.modules.find((module) => module.id === "automation"),
    );
    crosshairEditor?.setStatus(result.crosshairStatus);
    crosshairEditor?.setInstalled(
      result.modules.find((module) => module.id === "crosshair"),
    );
    renderConfig();
    crosshairEditor?.refresh();
    if (toolWindowPage) showPage(toolWindowPage);
    if (!desktop)
      notify("浏览器预览：原生工具请使用桌面客户端。");
  })
  .catch((error) => {
    failure(error);
    syncControls();
  });
