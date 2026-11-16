import * as Blockly from "blockly/core";
import {ACTION_BLOCK} from "./automation-blockly-codec.ts";
import {RecycleHistory, recycledState} from "./automation-recycle-history.ts";
import {stepSummary} from "./automation-step-summary.ts";

export function createWorkspaceControls(
  root: HTMLElement,
  workspace: Blockly.WorkspaceSvg,
  names: Record<string,string> = {},
) {
  const history = new RecycleHistory();
  const controls = document.createElement("div");
  controls.className = "auto-blockly-controls";
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "画布工具");
  for (const event of ["pointerdown", "keydown", "click"])
    controls.addEventListener(event, (e) => e.stopPropagation());
  const button = (label: string, action: () => void, path?: string) => {
    const element = document.createElement("button");
    element.type = "button";
    element.title = label;
    element.setAttribute("aria-label", label);
    if (path) element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
    else element.textContent = label;
    element.onclick = action;
    controls.append(element);
    return element;
  };
  const dialog = document.createElement("section");
  dialog.className = "auto-recycle-dialog";
  dialog.setAttribute("aria-label","回收站");
  dialog.hidden = true;
  const panelHost = root.closest('.automation-layout')?.querySelector('.auto-side-panel');
  const openPanel = (name = '') => root.dispatchEvent(new CustomEvent('auto-panel', {bubbles: true, detail: name}));
  const closeRecycle = () => {
    if (root.closest<HTMLElement>('.automation-layout')?.dataset.autoPanel === 'recycle') openPanel();
  };
  const header = document.createElement("div");
  header.className = "auto-recycle-header";
  const heading = document.createElement("h3");
  header.append(heading);
  const list = document.createElement("div");
  list.className = "auto-recycle-list";
  const feedback = document.createElement("p");
  feedback.setAttribute("role","status");
  feedback.className = "small";
  dialog.append(header,list,feedback);
  (panelHost ?? root).append(dialog);
  for (const type of ["pointerdown","click"])
    dialog.addEventListener(type,event=>event.stopPropagation());
  button("放大", () => workspace.zoomCenter(1), "M12 5v14M5 12h14");
  button("缩小", () => workspace.zoomCenter(-1), "M5 12h14");
  const recycle = button("回收站",() => {
    if (workspace.isReadOnly()) return;
    feedback.textContent = "";
    paint();
    openPanel('recycle');
  });
  recycle.className = "auto-recycle-button";
  recycle.setAttribute('aria-expanded', 'false');
  const dock = root.closest('.automation-layout')?.querySelector('.auto-canvas-tools');
  (dock ?? root).append(controls);
  controls.classList.add(dock ? "auto-blockly-controls-docked" : "auto-blockly-controls-floating");

  function paint() {
    recycle.textContent = history.entries.length ? `回收站 ${history.entries.length}` : "回收站";
    heading.textContent = `回收站（${history.entries.length}/30）`;
    list.replaceChildren();
    for (const entry of history.entries) {
      const row = document.createElement("div");
      row.className = "auto-recycle-row";
      const label = document.createElement("span");
      const step = entry.state.extraState?.step;
      label.textContent = step ? stepSummary(step,names) : "积木";
      label.title = label.textContent;
      const restore = document.createElement("button");
      restore.type = "button";
      restore.textContent = "恢复";
      restore.setAttribute("aria-label",`恢复：${label.textContent}`);
      restore.disabled = workspace.isReadOnly();
      restore.onclick = () => {
        if (workspace.isReadOnly()) return;
        Blockly.Events.setGroup(true);
        try {
          workspace.hideChaff();
          const state = recycledState(entry.state);
          const view = workspace.getMetricsManager().getViewMetrics(true);
          state.x = view.left + view.width / 2;
          state.y = view.top + view.height / 3;
          const block = Blockly.serialization.blocks.append(state,workspace,{recordUndo:true}) as Blockly.BlockSvg;
          history.remove(entry.key);
          openPanel();
          block.select();
          Blockly.getFocusManager().focusNode(block);
          workspace.centerOnBlock(block.id);
          paint();
        } catch(error) {
          feedback.textContent = "恢复失败：" + String(error);
        } finally {Blockly.Events.setGroup(false);}
      };
      row.append(label,restore);
      list.append(row);
    }
  }
  const onChange = (event: Blockly.Events.Abstract) => {
    if (event.type === Blockly.Events.BLOCK_DELETE) {
      const deleted = event as Blockly.Events.BlockDelete;
      if (!deleted.wasShadow && deleted.oldJson?.type === ACTION_BLOCK)
        history.add(deleted.oldJson,deleted.ids ?? []);
    } else if (event.type === Blockly.Events.BLOCK_CREATE) {
      history.restored((event as Blockly.Events.BlockCreate).ids ?? []);
    } else return;
    paint();
  };
  workspace.addChangeListener(onChange);
  return {
    close: closeRecycle,
    setRunning(running: boolean) {
      recycle.disabled = running;
      if (running) closeRecycle();
    },
    dispose() {
      workspace.removeChangeListener(onChange);
      closeRecycle();
      dialog.remove();
      controls.remove();
    },
  };
}
