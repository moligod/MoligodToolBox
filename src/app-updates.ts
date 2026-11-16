import {
  checkAppUpdate,
  desktop,
  installAppUpdate,
  type AppRelease,
} from "./api";

export function initAppUpdates(
  button: HTMLButtonElement,
  currentVersion: string,
) {
  button.disabled = !desktop;
  if (!desktop) {
    button.title = "更新检查仅在桌面客户端可用";
    return;
  }
  const dialog = document.createElement("dialog");
  dialog.className = "github-dialog app-update-dialog";
  dialog.setAttribute("aria-label", "软件更新");
  dialog.innerHTML = `<h2>软件更新</h2><p class="github-status" role="status"></p>
    <pre class="app-update-notes" hidden></pre><p class="dialog-error" role="alert"></p>
    <div class="dialog-actions"><button type="button" class="secondary" autofocus>取消</button><button type="button" class="app-update-install" hidden>更新</button></div>`;
  document.body.append(dialog);
  const status = dialog.querySelector<HTMLElement>(".github-status")!;
  const notes = dialog.querySelector<HTMLElement>(".app-update-notes")!;
  const error = dialog.querySelector<HTMLElement>(".dialog-error")!;
  const cancel = dialog.querySelector<HTMLButtonElement>(".secondary")!;
  const install = dialog.querySelector<HTMLButtonElement>(
    ".app-update-install",
  )!;
  let latest: AppRelease | null = null;
  let checking: Promise<void> | undefined;
  let installing = false;
  let checked = false;
  let checkError = "";

  function render() {
    button.classList.toggle("has-update", !!latest);
    button.title = latest
      ? `发现新版本 ${latest.version}，点击更新`
      : checkError || "检查更新";
    button.setAttribute(
      "aria-label",
      latest
        ? `当前 ${currentVersion}，有新版本 ${latest.version}`
        : `当前 ${currentVersion}，检查更新`,
    );
    if (!dialog.open || installing) return;
    install.hidden = !latest;
    install.textContent = checked ? "更新" : "重新检查";
    install.disabled = !!checking;
    notes.hidden = !latest?.notes;
    notes.textContent = latest?.notes ?? "";
    error.textContent = checkError;
    status.textContent = checking
      ? "正在检查更新…"
      : latest
        ? `是否更新到最新 ${latest.version} 版本？更新将关闭程序，请先保存任务。`
        : checkError
          ? ""
          : "当前已是最新版本";
  }
  function check(): Promise<void> {
    if (checking) return checking;
    checkError = "";
    checking = checkAppUpdate()
      .then((result) => {
        latest = result;
        checked = true;
      })
      .catch((reason) => {
        checkError = reason instanceof Error ? reason.message : String(reason);
        checked = false;
      })
      .finally(() => {
        checking = undefined;
        render();
      });
    render();
    return checking;
  }
  button.addEventListener("click", () => {
    if (dialog.open) return;
    dialog.showModal();
    render();
    if (!latest || !checked) void check();
  });
  cancel.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    if (installing) event.preventDefault();
  });
  install.addEventListener("click", () => {
    if (installing || !latest) return;
    if (!checked) {
      void check();
      return;
    }
    installing = true;
    cancel.disabled = true;
    install.disabled = true;
    error.textContent = "";
    status.textContent = "正在下载并校验更新，完成后将安装并重启，请稍候…";
    void installAppUpdate(latest.version)
      .catch((reason) => {
        checkError = reason instanceof Error ? reason.message : String(reason);
        checked = false;
      })
      .finally(() => {
        installing = false;
        cancel.disabled = false;
        install.disabled = false;
        render();
      });
  });
  void check();
}
