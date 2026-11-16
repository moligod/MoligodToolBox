import * as Blockly from "blockly/core";
import { automationAction, desktop } from "./api.ts";
import { componentState, scaledComponent, validateComponentImport, type Component } from "./automation-component-model.ts";
import { validScale } from "./automation-scale.ts";
import type { BlockState } from "./automation-blockly-codec.ts";
import { installComponentPreviews } from "./automation-component-preview.ts";

export type ComponentBackend = { list: () => Promise<Component[]>; import: (text:string) => Promise<Component[]>; add: (item:Component) => Promise<Component[]>; remove: (id:string) => Promise<Component[]>; rename: (id:string,name:string) => Promise<Component[]>; move: (id:string,targetId:string,after:boolean) => Promise<Component[]> };
export function installComponents(workspace: Blockly.WorkspaceSvg, roots: () => Blockly.Block[], scale: () => number | undefined, notify: (text:string, error?:boolean) => void, backend?: ComponentBackend) {
  let items: Component[] = [], loaded = false, loading = false, disposed = false, error = "", busy = false;
  let cancelEdit: (() => void) | undefined;
  let officialLibrary: ReturnType<typeof import("./official-components").createOfficialComponents> | undefined;
  let openingOfficial = false;
  let officialGeneration = 0;
  const expanded = new Set<string>();
  const previews = installComponentPreviews(workspace, id => items.find(item => item.id === id)?.name ?? "组件");
  const store = backend ?? (desktop ? {list:()=>automationAction<Component[]>("component-list"),import:(text:string)=>automationAction<Component[]>("component-import",text),add:(item:Component)=>automationAction<Component[]>("component-add",item),remove:(id:string)=>automationAction<Component[]>("component-remove",id),rename:(id:string,name:string)=>automationAction<Component[]>("component-rename",{id,name}),move:(id:string,targetId:string,after:boolean)=>automationAction<Component[]>("component-move",{id,targetId,after})} : undefined);
  const importDialog = document.createElement("dialog");
  importDialog.className = "auto-component-dialog";
  importDialog.setAttribute("aria-label", "导入组件");
  importDialog.innerHTML = `<form>
    <h2>导入组件</h2>
    <label>动作代码<textarea name="code" rows="8" autofocus required spellcheck="false" placeholder="粘贴他人分享的动作代码"></textarea></label>
    <p class="dialog-error" role="alert"></p>
    <div class="dialog-actions"><button type="button" class="secondary">取消</button><button type="submit">导入</button></div>
  </form>`;
  const codeInput = importDialog.querySelector("textarea")!;
  const importError = importDialog.querySelector<HTMLParagraphElement>(".dialog-error")!;
  const importSubmit = importDialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  importDialog.querySelector('button[type="button"]')!.addEventListener("click", () => importDialog.close());
  importDialog.addEventListener("close", () => {
    codeInput.value = "";
    codeInput.removeAttribute("aria-invalid");
    importError.textContent = "";
  });
  codeInput.addEventListener("input", () => {
    codeInput.removeAttribute("aria-invalid");
    importError.textContent = "";
  });
  workspace.getInjectionDiv().append(importDialog);
  importDialog.querySelector("form")!.addEventListener("submit", event => {
    event.preventDefault();
    if (disposed || busy || workspace.isReadOnly() || !store) return;
    const text = codeInput.value.trim();
    busy = true;
    importSubmit.disabled = true;
    void (async () => {
      try {
        if (!text) throw new Error("请粘贴动作代码");
        if (new TextEncoder().encode(text).length > 1024 * 1024) throw new Error("动作代码超过1MiB");
        validateComponentImport(text);
        const next = await store.import(text);
        if (disposed) return;
        items = next; loaded = true; error = "";
        importDialog.close();
        refresh("import", ".auto-component-import"); notify("组件已导入");
      } catch (reason) {
        if (disposed) return;
        const message = "导入失败：" + (reason instanceof Error ? reason.message : String(reason));
        if (importDialog.open) {
          importError.textContent = message;
          codeInput.setAttribute("aria-invalid", "true");
          codeInput.focus();
        } else notify(message, true);
      } finally {
        importSubmit.disabled = false;
        busy = false;
      }
    })();
  });
  function openImport() {
    if (disposed || busy || workspace.isReadOnly()) return;
    if (!store) { notify("请在桌面客户端导入组件", true); return; }
    if (!importDialog.open) importDialog.showModal();
  }
  function openOfficial() {
    if (disposed || busy || openingOfficial || workspace.isReadOnly()) return;
    if (!store) { notify("请在桌面客户端获取官方组件", true); return; }
    openingOfficial = true;
    const generation = ++officialGeneration;
    void import("./official-components").then(({ createOfficialComponents }) => {
      if (disposed || generation !== officialGeneration || workspace.isReadOnly()) return;
      officialLibrary ??= createOfficialComponents(workspace.getInjectionDiv(), async text => {
        if (disposed || busy || workspace.isReadOnly()) throw new Error("当前无法导入组件，请停止运行后重试");
        busy = true;
        try {
          validateComponentImport(text);
          const next = await store.import(text);
          if (disposed) return;
          items = next; loaded = true; error = "";
          refresh(); notify("官方组件已导入");
        } finally { busy = false; }
      });
      officialLibrary.open();
    }).catch(reason => { if (!disposed && generation === officialGeneration) notify(String(reason), true); })
      .finally(() => { if (generation === officialGeneration) openingOfficial = false; });
  }
  async function exportComponent(item: Component) {
    if (disposed) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify({schemaVersion:1, components:[item]}));
      if (!disposed) notify(`“${item.name}”动作代码已复制`);
    } catch (reason) {
      if (!disposed) notify("动作代码复制失败：" + String(reason), true);
    }
  }

  function paletteButton(root: SVGElement, kind: string, caption: string, label: string, activate: (keyboard: boolean) => void, box: {x:number; y:number; width:number; height:number; scale:number}) {
    let button = root.querySelector<SVGGElement>(`.auto-component-${kind}`);
    if (!button) {
      button = document.createElementNS("http://www.w3.org/2000/svg", "g");
      button.classList.add("auto-component-button", `auto-component-${kind}`);
      button.setAttribute("role", "button");
      button.setAttribute("tabindex", "0");
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      button.append(rect, text);
      root.append(button);
      for (const event of ["pointerdown", "pointerup"]) button.addEventListener(event, event => event.stopPropagation());
      button.addEventListener("click", event => { event.stopPropagation(); activate(false); });
      button.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault(); event.stopPropagation(); activate(true);
        }
      });
    }
    button.setAttribute("aria-label", label);
    button.setAttribute("transform", `translate(${box.x},${box.y})`);
    const rect = button.querySelector("rect")!, text = button.querySelector("text")!;
    rect.setAttribute("width", String(box.width)); rect.setAttribute("height", String(box.height));
    rect.setAttribute("rx", String(4 / box.scale));
    text.textContent = caption;
    text.setAttribute("x", String(box.width / 2)); text.setAttribute("y", String(box.height / 2));
    text.setAttribute("font-size", String(12 / box.scale));
    return button;
  }
  const refresh = (focusId?: string, focusSelector = ".auto-component-toggle") => {
    const selected = workspace.getToolbox()?.getSelectedItem();
    if (!disposed && selected instanceof Blockly.ToolboxCategory && selected.getName() === "组件库") {
      cancelEdit?.();
      workspace.refreshToolboxSelection();
      requestAnimationFrame(() => {
        if (disposed) return;
        layout();
        if (focusId) for (const entry of workspace.getFlyout()?.getContents() ?? []) {
          const label = entry.getElement();
          if (label instanceof Blockly.FlyoutButton && (label.info as {id?:string}).id === `component-${focusId}`)
            label.getSvgRoot().querySelector<SVGElement>(focusSelector)?.focus();
        }
      });
    }
  };
  async function load() {
    if (loading || loaded) return;
    if (!store) { loaded = true; return; }
    loading = true;
    try { items = await store.list(); loaded = true; error = ""; }
    catch (reason) { loaded = true; error = "组件库读取失败"; notify(error + "：" + String(reason), true); }
    finally { loading = false; refresh(); }
  }
  function save() {
    if (workspace.isReadOnly() || busy || error) return;
    let snapshot: Blockly.Block[];
    let initial: BlockState;
    let sourceScale: number | undefined;
    try {
      snapshot = roots();
      initial = componentState(snapshot, "组件");
      sourceScale = scale();
      if (!validScale(sourceScale)) throw new Error("当前任务没有有效缩放，请先确定任务的屏幕缩放");
      if (!store) throw new Error("请在桌面客户端保存组件");
    } catch (error) { notify(String(error), true); return; }
    Blockly.dialog.prompt("组件名称", "新组件", name => {
      if (name === null) return;
      const clean = name.trim();
      if (!clean || [...clean].length > 60 || /[\x00-\x1f\x7f]/.test(clean)) { notify("组件名称请输入1–60个字符", true); return; }
      if (workspace.isReadOnly() || disposed || busy) { notify("任务运行中或组件正在保存", true); return; }
      initial.extraState!.step!.action.name = clean;
      const component = { id: crypto.randomUUID(), name: clean, block: initial, scale: sourceScale };
      busy = true;
      void store!.add(component).then(next => {
        if (disposed) return;
        items = next; loaded = true; notify("组件已保存"); refresh();
      }).catch(error => notify("组件保存失败：" + String(error), true)).finally(() => { busy = false; });
    });
  }
  workspace.registerButtonCallback("COMPONENT_RETRY", () => { loaded = false; error = ""; void load(); });
  const deleteDialog = document.createElement("dialog");
  deleteDialog.className = "auto-component-dialog auto-component-delete-dialog";
  deleteDialog.setAttribute("aria-label", "删除组件");
  deleteDialog.innerHTML = `<form>
    <h2>删除组件</h2>
    <p class="auto-component-delete-message"></p>
    <p class="dialog-error" role="alert"></p>
    <div class="dialog-actions"><button type="button" class="secondary" autofocus>取消</button><button type="submit" class="danger">删除</button></div>
  </form>`;
  const deleteMessage = deleteDialog.querySelector<HTMLParagraphElement>(".auto-component-delete-message")!;
  const deleteError = deleteDialog.querySelector<HTMLParagraphElement>(".dialog-error")!;
  const deleteSubmit = deleteDialog.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  let pendingDelete: Component | undefined;
  deleteDialog.querySelector('button[type="button"]')!.addEventListener("click", () => deleteDialog.close());
  deleteDialog.addEventListener("close", () => { pendingDelete = undefined; deleteError.textContent = ""; });
  workspace.getInjectionDiv().append(deleteDialog);
  deleteDialog.querySelector("form")!.addEventListener("submit", event => {
    event.preventDefault();
    if (disposed || workspace.isReadOnly() || busy || !store || !pendingDelete) return;
    const item = pendingDelete;
    busy = true;
    deleteSubmit.disabled = true;
    void store.remove(item.id).then(next => {
      if (disposed) return;
      items = next; expanded.delete(item.id);
      deleteDialog.close();
      refresh("import", ".auto-component-import"); notify("组件已删除");
    }).catch(reason => {
      if (disposed) return;
      const message = "组件删除失败：" + String(reason);
      if (deleteDialog.open) deleteError.textContent = message;
      else notify(message, true);
    }).finally(() => { busy = false; deleteSubmit.disabled = false; });
  });
  function remove(item: Component) {
    if (disposed || workspace.isReadOnly() || busy || !store || deleteDialog.open) return;
    pendingDelete = item;
    deleteMessage.textContent = `确定删除组件“${item.name}”？`;
    deleteDialog.showModal();
  }
  function rename(item: Component, handle: SVGRectElement) {
    if (workspace.isReadOnly() || busy || !store || disposed) return;
    cancelEdit?.();
    const root = handle.parentElement!;
    const text = root.querySelector<SVGTextElement>(".blocklyFlyoutLabelText")!;
    const editor = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    editor.classList.add("auto-component-name-editor");
    for (const key of ["x", "y", "width", "height"]) editor.setAttribute(key, handle.getAttribute(key)!);
    const input = document.createElement("input");
    input.className = "auto-component-name-input";
    input.style.font = window.getComputedStyle(text).font;
    input.setAttribute("aria-label", "组件名称");
    input.value = item.name;
    input.spellcheck = false;
    let closed = false;
    const finish = (commit: boolean, focus = false) => {
      if (closed) return;
      const clean = input.value.trim();
      commit &&= !disposed && !workspace.isReadOnly();
      if (commit && (!clean || [...clean].length > 60 || /[\x00-\x1f\x7f]/.test(clean))) {
        input.setAttribute("aria-invalid", "true");
        notify("组件名称请输入1–60个字符", true);
        return;
      }
      closed = true;
      cancelEdit = undefined;
      text.style.removeProperty("visibility");
      editor.remove();
      if (focus) handle.focus();
      if (!commit || clean === item.name || busy) return;
      busy = true;
      void store.rename(item.id, clean).then(next => {
        if (!disposed) { items = next; refresh(focus ? item.id : undefined, ".auto-component-handle"); notify("组件名称已修改"); }
      }).catch(reason => notify("组件重命名失败：" + String(reason), true)).finally(() => { busy = false; });
    };
    cancelEdit = () => finish(false);
    for (const event of ["pointerdown", "pointerup", "click", "dblclick", "wheel", "keydown"]) input.addEventListener(event, event => event.stopPropagation());
    input.addEventListener("keydown", event => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        finish(event.key === "Enter", true);
      }
    });
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
    text.style.visibility = "hidden";
    editor.append(input); root.append(editor);
    input.focus(); input.select();
  }
  function move(item: Component, targetId: string, after: boolean) {
    if (workspace.isReadOnly() || busy || !store || item.id === targetId) return;
    busy = true;
    void store.move(item.id, targetId, after).then(next => { if (!disposed) { items = next; refresh(); notify("组件顺序已调整"); } }).catch(reason => notify("组件排序失败：" + String(reason), true)).finally(() => { busy = false; });
  }
  workspace.registerToolboxCategoryCallback("MOLIGOD_COMPONENTS", () => {
    void load();
    const contents: Blockly.utils.toolbox.FlyoutItemInfo[] = [
      {kind:"label",text:"导入组件库",id:"component-import"},
    ];
    if (!loaded || loading) return [{kind:"label",text:"正在读取组件…",id:undefined}];
    if (error) return [{kind:"label",text:error,id:undefined},{kind:"button",text:"重试读取",callbackkey:"COMPONENT_RETRY"}];
    if (!items.length) return [...contents,
      {kind:"label",text:"右键选中的积木，点击保存成组件",id:"component-empty-1"},
      {kind:"label",text:"按 Shift / Ctrl 多选",id:"component-empty-2"},
    ];
    for (const item of items) {
      const text = [...item.name].length > 14 ? [...item.name].slice(0,14).join("") + "…" : item.name;
      contents.push({kind:"label",text,id:`component-${item.id}`});
      if (expanded.has(item.id)) {
        try {
          contents.push({kind:"block",...scaledComponent(item,scale()),id:`component-preview-${item.id}`,gap:12});
          contents.push({kind:"label",text:" ",id:`component-pan-${item.id}`});
        }
        catch { contents.push({kind:"label",text:"缩放或组件内容无效，无法放置",id:undefined}); }
      }
    }
    // Reserve room for the name and three controls even when all cards are collapsed.
    contents.push({kind:"label",text:"组件库组件库组件库组件库组件库组件库组件库组件组件库",id:"component-width"});
    return contents;
  });
  function layout() {
    const flyout = workspace.getFlyout();
    const svg = workspace.getInjectionDiv().querySelector<SVGSVGElement>(".blocklyFlyout");
    if (!flyout || !svg || !svg.getClientRects().length) return;
    previews.layout();
    const selected = workspace.getToolbox()?.getSelectedItem();
    const showEmpty = selected instanceof Blockly.ToolboxCategory && selected.getName() === "组件库" && loaded && !loading && !error && !items.length;
    let empty = svg.querySelector<SVGGElement>(".auto-component-empty");
    if (showEmpty && !empty) {
      empty = document.createElementNS("http://www.w3.org/2000/svg", "g");
      empty.classList.add("auto-component-empty");
      empty.setAttribute("role", "status");
      for (const [index, value] of ["右键选中的积木，点击保存成组件", "按 Shift / Ctrl 多选"].entries()) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.textContent = value; text.setAttribute("text-anchor", "middle"); text.setAttribute("y", index ? "14" : "-14");
        empty.append(text);
      }
      svg.append(empty);
    }
    if (empty) {
      empty.style.display = showEmpty ? "" : "none";
      if (showEmpty) {
        const matrix = svg.getScreenCTM(), bounds = svg.getBoundingClientRect();
        if (matrix) {
          const center = new DOMPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2).matrixTransform(matrix.inverse());
          empty.setAttribute("transform", `translate(${center.x},${center.y})`);
        }
      }
    }
    for (const entry of flyout.getContents()) {
      const label = entry.getElement();
      if (!(label instanceof Blockly.FlyoutButton) || !label.isLabel()) continue;
      const id = (label.info as {id?:string}).id;
      const root = label.getSvgRoot();
      if (id === "component-width") { root.classList.add("auto-component-placeholder", "auto-component-tip"); root.setAttribute("aria-hidden", "true"); continue; }
      if (id?.startsWith("component-empty-")) { root.classList.add("auto-component-tip", "auto-component-placeholder"); root.setAttribute("aria-hidden", "true"); continue; }
      if (id?.startsWith("component-pan-")) continue;
      const item = items.find(component => id === `component-${component.id}`);
      if (!item && id !== "component-import") continue;
      const text = root.querySelector<SVGTextElement>(".blocklyFlyoutLabelText");
      const matrix = root.getScreenCTM();
      if (!text || !matrix) continue;
      const size = Math.hypot(matrix.a, matrix.b);
      if (!size) continue;
      let bounds = text.getBBox();
      if (id === "component-import") {
        root.classList.add("auto-component-tip");
        text.style.visibility = "hidden";
        const flyoutBounds = svg.getBoundingClientRect();
        const center = new DOMPoint((flyoutBounds.left + flyoutBounds.right) / 2, root.getBoundingClientRect().top).matrixTransform(matrix.inverse());
        const controlsWidth = Math.min(230, Math.max(112, flyoutBounds.right - flyoutBounds.left - 16));
        const buttonWidth = (controlsWidth - 6) / 2;
        paletteButton(root, "official", "获取官方组件", "获取官方组件", openOfficial, {
          x: center.x - controlsWidth / 2 / size, y: bounds.y + bounds.height / 2 - 14 / size,
          width: buttonWidth / size, height: 28 / size, scale: size,
        });
        paletteButton(root, "import", "导入组件库", "导入组件库", openImport, {
          x: center.x + 3 / size, y: bounds.y + bounds.height / 2 - 14 / size,
          width: buttonWidth / size, height: 28 / size, scale: size,
        });
        continue;
      }
      if (!item) continue;
      text.setAttribute("text-anchor", "start");
      text.setAttribute("x", "0");
      bounds = text.getBBox();
      let title = root.querySelector<SVGTitleElement>(".auto-component-title");
      if (!title) { title = document.createElementNS("http://www.w3.org/2000/svg", "title"); title.classList.add("auto-component-title"); root.append(title); }
      title.textContent = item.name;
      const right = new DOMPoint(svg.getBoundingClientRect().right - 14, root.getBoundingClientRect().top).matrixTransform(matrix.inverse()).x;
      const controlWidth = Math.min(52, Math.max(26, (svg.getBoundingClientRect().width - 104) / 3));
      const width = controlWidth / size, height = 24 / size, gap = 6 / size;
      const x = right - width, y = bounds.y + bounds.height / 2 - height / 2;
      const exportX = x - 2 * (width + gap);
      const nameWidth = exportX - 8 / size - bounds.x;
      const characters = [...item.name];
      let length = Math.min(characters.length, 14);
      text.textContent = characters.slice(0, length).join("") + (length < characters.length ? "…" : "");
      while (length > 1 && text.getBBox().width > nameWidth) {
        text.textContent = characters.slice(0, --length).join("") + "…";
      }
      bounds = text.getBBox();
      let handle = root.querySelector<SVGRectElement>(".auto-component-handle");
      if (!handle) {
        handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        handle.classList.add("auto-component-handle");
        root.insertBefore(handle, text);
        const dragArea = handle;
        dragArea.addEventListener("pointerdown", event => {
          if (event.button !== 0 || busy || workspace.isReadOnly()) return;
          event.preventDefault(); event.stopPropagation();
          dragArea.setPointerCapture(event.pointerId);
          const startX = event.clientX, startY = event.clientY;
          let moved = false, target: {id:string; after:boolean} | undefined, done = false, frame = 0, currentX = startX, currentY = startY;
          const listeners = new AbortController(), signal = listeners.signal;
          const clear = () => workspace.getInjectionDiv().querySelectorAll(".auto-component-drop-before,.auto-component-drop-after,.auto-component-dragging").forEach(node => node.classList.remove("auto-component-drop-before","auto-component-drop-after","auto-component-dragging"));
          const finish = (commit:boolean) => {
            if (done) return; done = true; listeners.abort(); cancelAnimationFrame(frame); clear();
            if (dragArea.hasPointerCapture(event.pointerId)) dragArea.releasePointerCapture(event.pointerId);
            if (commit && moved && target) move(item, target.id, target.after);
            else if (commit && !moved) rename(item, dragArea);
          };
          const locate = () => {
            clear(); target = undefined;
            if (!moved) return;
            root.classList.add("auto-component-dragging");
            const box = svg.getBoundingClientRect();
            if (currentX < box.left || currentX > box.right || currentY < box.top || currentY > box.bottom) return;
            const rows = (flyout.getContents()).map(entry => entry.getElement()).filter((entry): entry is Blockly.FlyoutButton => entry instanceof Blockly.FlyoutButton && items.some(component => `component-${component.id}` === (entry.info as {id?:string}).id));
            const over = rows.find(row => currentY < row.getSvgRoot().getBoundingClientRect().bottom) ?? rows[rows.length-1];
            if (!over) return;
            const id = (over.info as {id:string}).id.slice("component-".length);
            if (id === item.id) return;
            const rect = over.getSvgRoot().getBoundingClientRect(), after = currentY > rect.top + rect.height / 2;
            target = {id, after}; over.getSvgRoot().classList.add(after ? "auto-component-drop-after" : "auto-component-drop-before");
          };
          const scroll = () => {
            if (moved && currentX >= svg.getBoundingClientRect().left && currentX <= svg.getBoundingClientRect().right) {
              const box = svg.getBoundingClientRect();
              const delta = currentY >= box.top && currentY < box.top + 25 ? 6 : currentY <= box.bottom && currentY > box.bottom - 25 ? -6 : 0;
              if (delta) { const flyoutWorkspace = flyout.getWorkspace(); flyoutWorkspace.scroll(flyoutWorkspace.scrollX, flyoutWorkspace.scrollY + delta, false); locate(); }
            }
            frame = requestAnimationFrame(scroll);
          };
          dragArea.addEventListener("pointermove", next => {
            if (next.pointerId !== event.pointerId) return;
            currentX = next.clientX; currentY = next.clientY;
            moved ||= Math.hypot(currentX-startX, currentY-startY) > 5;
            locate();
          }, {signal});
          dragArea.addEventListener("pointerup", next => { if (next.pointerId === event.pointerId) finish(true); }, {signal});
          dragArea.addEventListener("pointercancel", () => finish(false), {signal});
          dragArea.addEventListener("lostpointercapture", () => finish(false), {signal});
          window.addEventListener("blur", () => finish(false), {signal});
          document.addEventListener("keydown", key => { if (key.key === "Escape") { key.preventDefault(); finish(false); } }, {signal});
          frame = requestAnimationFrame(scroll);
        });
        text.style.pointerEvents = "none";
        dragArea.setAttribute("role", "button"); dragArea.setAttribute("tabindex", "0");
        dragArea.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); rename(item, dragArea); } });
      }
      handle.setAttribute("aria-label", `修改或拖动组件：${item.name}`);
      handle.setAttribute("x", String(bounds.x)); handle.setAttribute("y", String(y));
      handle.setAttribute("width", String(Math.max(bounds.width, exportX - 8 / size - bounds.x)));
      handle.setAttribute("height", String(height));
      const editor = root.querySelector(".auto-component-name-editor");
      if (editor) for (const key of ["x", "y", "width", "height"]) editor.setAttribute(key, handle.getAttribute(key)!);
      const box = {y, width, height, scale:size};
      paletteButton(root, "export", "导出", `导出组件：${item.name}`, () => { void exportComponent(item); }, {x:exportX, ...box});
      const toggleCaption = expanded.has(item.id) ? "收起" : "展开";
      const toggle = paletteButton(root, "toggle", toggleCaption, `${toggleCaption}组件：${item.name}`, keyboard => {
        if (expanded.has(item.id)) expanded.delete(item.id); else expanded.add(item.id);
        refresh(keyboard ? item.id : undefined);
      }, {x:x - width - gap, ...box});
      toggle.setAttribute("aria-expanded", String(expanded.has(item.id)));
      paletteButton(root, "delete", "删除", `删除组件：${item.name}`, () => remove(item), {x, ...box});
      root.dataset.componentDeleteX = String(exportX);
    }
  }
  const closeEditors = () => {
    officialGeneration++;
    openingOfficial = false;
    officialLibrary?.close();
    cancelEdit?.();
    if (importDialog.open) importDialog.close();
    if (deleteDialog.open) deleteDialog.close();
  };
  return { refresh, save, layout, cancelEdit: closeEditors, dispose() { disposed = true; closeEditors(); officialLibrary?.dispose(); previews.dispose(); importDialog.remove(); deleteDialog.remove(); } };
}
