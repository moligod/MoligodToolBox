import * as Blockly from "blockly/core";
import { ACTION_BLOCK, START_BLOCK } from "./automation-blockly-codec.ts";
import type { ActionBlock } from "./automation-blockly-blocks.ts";
import { selectedRoots, closestInsertion, dragAdjustment, stackOffsets, moveSelected } from "./automation-blockly-multidrag.ts";

export class ActionSelection {
  ids = new Set<string>();
  anchor?: string;
  clear() { this.ids.clear(); this.anchor = undefined; }
  selectForContext(id: string, order: string[]) {
    if (!this.ids.has(id)) this.click(id, order, false, false);
  }
  click(id: string, order: string[], shift: boolean, ctrl: boolean) {
    const start = this.anchor ? order.indexOf(this.anchor) : -1;
    const end = order.indexOf(id);
    if (shift && start >= 0 && end >= 0) {
      if (!ctrl) this.ids.clear();
      order.slice(Math.min(start, end), Math.max(start, end) + 1).forEach(item => this.ids.add(item));
    } else if (ctrl) {
      if (this.ids.has(id)) this.ids.delete(id); else this.ids.add(id);
      this.anchor = id;
    } else {
      this.ids = new Set([id]);
      this.anchor = id;
    }
  }
}

/** Select action cards without changing the serialized script or Blockly's drag behavior. */
export function installActionSelection(host: HTMLElement, workspace: Blockly.WorkspaceSvg, notify: (message: string, error?: boolean) => void) {
  const selection = new ActionSelection();
  const listeners = new AbortController();
  const style = document.createElement("style");
  style.textContent = ".auto-blockly .auto-action-selected>.blocklyPath{stroke:#bbed76!important;stroke-width:3px!important}";
  host.append(style);
  let pending: { id: string; pointer: number; x: number; y: number; shift: boolean; ctrl: boolean; multi: boolean; dragging: boolean } | undefined;
  let ghost: HTMLElement | undefined, marker: HTMLElement | undefined;
  let moving: ReturnType<typeof selectedRoots> = [];
  let adjustment = {x:0,y:0};
  let previewOrigin: { x: number; y: number } | undefined;
  function removePreview() { ghost?.remove(); marker?.remove(); ghost = marker = undefined; moving = []; }
  function createPreview(roots: ReturnType<typeof selectedRoots>, grabbed: Blockly.Block | null) {
    ghost = document.createElement("div");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.cssText = "position:fixed;z-index:9999;pointer-events:none;opacity:.85";
    document.body.append(ghost);
    const first = roots[0]?.getSvgRoot().getBoundingClientRect();
    previewOrigin = first ? { x: first.left, y: first.top } : undefined;
    const offsets = stackOffsets(roots);
    let grabbedRoot = grabbed;
    while (grabbedRoot && !roots.includes(grabbedRoot as (typeof roots)[number])) grabbedRoot = grabbedRoot.getSurroundParent();
    for (let index = 0; index < roots.length; index++) {
      const root = roots[index];
      if (index >= 12 && root !== grabbedRoot) continue;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const copy = root.getSvgRoot().cloneNode(true) as SVGGElement;
      const originalText = root.getSvgRoot().querySelectorAll("text");
      copy.querySelectorAll("text").forEach((text, index) => { text.style.fill = getComputedStyle(originalText[index]).fill; });
      for (const child of copy.querySelectorAll<SVGGElement>("g.moligod_action[data-id]")) {
        let parent = workspace.getBlockById(child.dataset.id!)?.getSurroundParent();
        while (parent && parent.id !== root.id) parent = parent.getSurroundParent();
        if (!parent) child.remove();
      }
      copy.removeAttribute("transform");
      for (const item of [copy, ...copy.querySelectorAll("[id], [data-id]")]) { item.removeAttribute("id"); item.removeAttribute("data-id"); }
      svg.append(copy); ghost.append(svg);
      const bounds = copy.getBBox();
      svg.setAttribute("viewBox", `${bounds.x - 3} ${bounds.y - 3} ${bounds.width + 6} ${bounds.height + 6}`);
      svg.style.cssText = `position:absolute;left:${offsets[index].x * workspace.scale}px;top:${offsets[index].y * workspace.scale}px;width:${(bounds.width + 6) * workspace.scale}px;height:${(bounds.height + 6) * workspace.scale}px`;
    }
    const omitted = roots.length - 12 - (grabbedRoot && roots.indexOf(grabbedRoot as (typeof roots)[number]) >= 12 ? 1 : 0);
    if (omitted > 0) {
      const remaining = document.createElement("div");
      remaining.textContent = `+${omitted}`;
      remaining.style.cssText = `position:absolute;left:140px;top:${offsets[12].y * workspace.scale}px;padding:6px;background:#243342;color:#f4f8ef`;
      ghost.append(remaining);
    }
  }
  function paint() {
    for (const block of workspace.getAllBlocks(false)) {
      if (block.type === ACTION_BLOCK) (block as Blockly.BlockSvg).getSvgRoot().classList.toggle("auto-action-selected", selection.ids.has(block.id));
    }
  }
  function clear() { pending = undefined; removePreview(); selection.clear(); paint(); }
  function ordered(block: Blockly.Block): string[] {
    const result: string[] = [];
    function visit(first: Blockly.Block | null) {
      for (let current = first; current; current = current.getNextBlock()) {
        if (current.type !== ACTION_BLOCK) continue;
        result.push(current.id);
        if (!current.isCollapsed()) for (const branch of (current as ActionBlock).readState().branches ?? []) visit(current.getInputTargetBlock("BODY_" + branch.key));
      }
    }
    const root = block.getRootBlock();
    visit(root.type === START_BLOCK ? root.getInputTargetBlock("BODY") : root);
    return result;
  }
  function selectForContext(block: Blockly.Block) {
    selection.selectForContext(block.id, ordered(block));
    paint();
  }
  function down(event: PointerEvent) {
    if (![0,2].includes(event.button) || workspace.isReadOnly() || !(event.target instanceof Element) || !host.contains(event.target) || event.target.closest(".blocklyFlyout, .blocklyToolbox")) return;
    const target = event.target;
    if (target.closest("[role=button], input, textarea, select, .blocklyEditableField")) return;
    const node = target.closest<SVGGElement>("g.blocklyBlock[data-id]");
    const block = node && workspace.getBlockById(node.dataset.id!);
    if (!block || block.type !== ACTION_BLOCK || block.isInsertionMarker()) {
      if (event.button === 0 && target.closest(".blocklyMainBackground")) clear();
      return;
    }
    if (event.button === 2) {
      selectForContext(block);
      return;
    }
    const multi = selection.ids.size > 1 && selection.ids.has(block.id);
    pending = { id: block.id, pointer: event.pointerId, x: event.clientX, y: event.clientY, shift: event.shiftKey, ctrl: event.ctrlKey, multi, dragging: false };
    if (multi) host.setPointerCapture(event.pointerId);
    if (event.shiftKey || event.ctrlKey || multi) { event.preventDefault(); event.stopImmediatePropagation(); }
  }
  function move(event: PointerEvent) {
    const press = pending;
    if (!press?.multi || press.pointer !== event.pointerId) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!press.dragging && Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 5) return;
    press.dragging = true;
    if (!ghost) {
      moving = selectedRoots(workspace, selection.ids);
      const grabbed = workspace.getBlockById(press.id);
      adjustment = grabbed ? dragAdjustment(workspace, moving, grabbed) : {x:0,y:0};
      createPreview(moving, grabbed);
      marker = document.createElement("div");
      marker.style.cssText = "position:fixed;z-index:9999;pointer-events:none;width:38px;height:5px;background:#bbed76;border-radius:4px";
      document.body.append(marker);
    }
    if (ghost) {
      ghost.style.left = `${(previewOrigin?.x ?? press.x) + event.clientX - press.x + adjustment.x}px`;
      ghost.style.top = `${(previewOrigin?.y ?? press.y) + event.clientY - press.y + adjustment.y}px`;
    }
    const candidate = closestInsertion(workspace, moving, event.clientX - press.x + adjustment.x, event.clientY - press.y + adjustment.y);
    if (marker) {
      marker.hidden = !candidate;
      if (candidate) { marker.style.left = `${candidate.x - 10}px`; marker.style.top = `${candidate.y - 2}px`; }
    }
  }
  function up(event: PointerEvent) {
    const press = pending;
    if (!press || press.pointer !== event.pointerId) return;
    pending = undefined;
    if (press.shift || press.ctrl || press.multi) { event.preventDefault(); event.stopImmediatePropagation(); }
    if (press.multi && press.dragging) {
      const background = host.querySelector(".blocklyMainBackground")?.getBoundingClientRect();
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (background && event.clientX >= background.left && event.clientX < background.right && event.clientY >= background.top && event.clientY < background.bottom && !target?.closest(".blocklyFlyout, .blocklyToolbox, .auto-side-panel, .auto-canvas-tools, .auto-log-dock")) {
        const roots = moving;
        const dx = event.clientX - press.x + adjustment.x, dy = event.clientY - press.y + adjustment.y;
        const candidate = closestInsertion(workspace, roots, dx, dy);
        try {
          moveSelected(workspace, roots, candidate, dx, dy);
          paint();
        } catch (error) { notify(String(error), true); }
      }
      removePreview();
      return;
    }
    removePreview();
    if (workspace.isReadOnly() || workspace.isDragging() || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) return;
    const block = workspace.getBlockById(press.id);
    if (!block || block.type !== ACTION_BLOCK) return;
    if (press.shift || press.ctrl) {
      const native = Blockly.common.getSelected();
      if (native instanceof Blockly.BlockSvg && native.workspace === workspace) native.unselect();
    }
    if (press.multi && !press.shift && !press.ctrl) (block as Blockly.BlockSvg).select();
    selection.click(block.id, ordered(block), press.shift, press.ctrl);
    paint();
  }
  const capture = { capture: true, signal: listeners.signal };
  document.addEventListener("pointerdown", down, capture);
  document.addEventListener("pointermove", move, capture);
  document.addEventListener("pointerup", up, capture);
  document.addEventListener("pointercancel", () => { pending = undefined; removePreview(); }, capture);
  document.addEventListener("keydown", event => {
    if (pending?.dragging && event.key === "Escape") { pending = undefined; removePreview(); event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (selection.ids.size < 2 || !["Delete", "Backspace"].includes(event.key) || !(event.target instanceof Element) || !host.contains(event.target) || event.target.closest("input, textarea, select, [contenteditable=true]")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, capture);
  return { clear, selectForContext, roots: () => selectedRoots(workspace, selection.ids), active: () => !!pending?.dragging, dispose() { listeners.abort(); clear(); style.remove(); } };
}
