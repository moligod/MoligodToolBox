import { officialComponentCatalog, officialComponentCode } from "./api";

export function createOfficialComponents(
  host: HTMLElement,
  importCode: (code: string) => Promise<void>,
) {
  const dialog = document.createElement("dialog");
  dialog.className = "github-dialog";
  dialog.setAttribute("aria-label", "获取官方组件");
  dialog.innerHTML = `<h2>获取官方组件</h2>
    <p class="github-status" role="status"></p>
    <div class="official-component-list"></div>
    <p class="dialog-error" role="alert"></p>
    <form method="dialog" class="dialog-actions"><button type="button" class="secondary github-retry">重新获取</button><button autofocus>关闭</button></form>`;
  host.append(dialog);
  const status = dialog.querySelector<HTMLElement>(".github-status")!;
  const list = dialog.querySelector<HTMLElement>(".official-component-list")!;
  const error = dialog.querySelector<HTMLElement>(".dialog-error")!;
  const retry = dialog.querySelector<HTMLButtonElement>(".github-retry")!;
  let generation = 0;
  let importing = false;
  let disposed = false;

  async function load() {
    const current = ++generation;
    list.replaceChildren();
    error.textContent = "";
    status.textContent = "正在获取官方组件…";
    retry.disabled = true;
    try {
      const catalog = await officialComponentCatalog();
      if (current !== generation || !dialog.open || disposed) return;
      status.textContent = catalog.components.length
        ? ""
        : "官方组件库暂时为空";
      for (const item of catalog.components) {
        const row = document.createElement("div");
        row.className = "official-component-row";
        const copy = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name;
        const description = document.createElement("p");
        description.textContent = item.description;
        copy.append(name, description);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "导入";
        button.addEventListener("click", () => {
          if (importing || disposed) return;
          importing = true;
          retry.disabled = true;
          for (const control of list.querySelectorAll("button"))
            control.disabled = true;
          error.textContent = "";
          status.textContent = "正在下载组件…";
          void (async () => {
            try {
              const code = await officialComponentCode(item.id);
              if (current !== generation || !dialog.open || disposed) return;
              await importCode(code);
              if (current === generation && dialog.open && !disposed)
                status.textContent = `“${item.name}”已导入`;
            } catch (reason) {
              if (current === generation && dialog.open && !disposed) {
                status.textContent = "";
                error.textContent =
                  reason instanceof Error ? reason.message : String(reason);
              }
            } finally {
              importing = false;
              if (current === generation && !disposed) {
                retry.disabled = false;
                for (const control of list.querySelectorAll("button"))
                  control.disabled = false;
              }
            }
          })();
        });
        row.append(copy, button);
        list.append(row);
      }
    } catch (reason) {
      if (current === generation && dialog.open && !disposed) {
        status.textContent = "";
        error.textContent =
          reason instanceof Error ? reason.message : String(reason);
      }
    } finally {
      if (current === generation && !disposed) retry.disabled = false;
    }
  }
  retry.addEventListener("click", () => void load());
  dialog.addEventListener("close", () => {
    generation++;
  });
  return {
    open() {
      if (disposed || dialog.open || importing) return;
      dialog.showModal();
      void load();
    },
    close() {
      if (dialog.open) dialog.close();
    },
    dispose() {
      disposed = true;
      generation++;
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}
