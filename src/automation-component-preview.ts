import * as Blockly from "blockly/core";

interface Preview {
  block: Blockly.BlockSvg;
  label: SVGElement;
  foreign: SVGForeignObjectElement;
  scroller: HTMLDivElement;
  spacer: HTMLDivElement;
  originX: number;
  width: number;
  contentWidth: number;
  scroll: () => void;
  stop: (event: Event) => void;
}

/** Give expanded components independent horizontal scrollbars inside the palette. */
export function installComponentPreviews(workspace: Blockly.WorkspaceSvg, name: (id: string) => string) {
  const previews = new Map<string, Preview>();
  const remove = (id: string) => {
    const preview = previews.get(id)!;
    preview.scroller.removeEventListener("scroll", preview.scroll);
    for (const type of ["pointerdown", "pointerup", "click", "keydown", "wheel"])
      preview.scroller.removeEventListener(type, preview.stop);
    preview.foreign.remove();
    previews.delete(id);
  };
  const applyScroll = (preview: Preview) => {
    const offset = Math.min(preview.scroller.scrollLeft, Math.max(0, preview.contentWidth - preview.width));
    preview.scroller.scrollLeft = offset;
    const delta = preview.originX - offset - preview.block.getRelativeToSurfaceXY().x;
    if (!delta) return;
    Blockly.Events.disable();
    try { preview.block.moveBy(delta, 0); }
    finally { Blockly.Events.enable(); }
  };
  return {
    layout() {
      const flyout = workspace.getFlyout();
      const svg = workspace.getInjectionDiv().querySelector<SVGSVGElement>(".blocklyFlyout");
      if (!flyout || !svg || !svg.getClientRects().length) return;
      const seen = new Set<string>();
      for (const entry of flyout.getContents()) {
        const label = entry.getElement();
        if (!(label instanceof Blockly.FlyoutButton)) continue;
        const marker = (label.info as {id?: string}).id;
        if (!marker?.startsWith("component-pan-")) continue;
        const id = marker.slice("component-pan-".length);
        const block = flyout.getWorkspace().getBlockById(`component-preview-${id}`) as Blockly.BlockSvg | null;
        if (!block) continue;
        const root = label.getSvgRoot();
        root.classList.add("auto-component-tip");
        const text = root.querySelector<SVGTextElement>(".blocklyFlyoutLabelText")!;
        text.style.visibility = "hidden";
        const matrix = root.getScreenCTM();
        if (!matrix) continue;
        const scale = Math.hypot(matrix.a, matrix.b);
        if (!scale) continue;
        let preview = previews.get(id);
        if (preview && preview.label !== root) { remove(id); preview = undefined; }
        if (!preview) {
          const foreign = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
          const scroller = document.createElement("div");
          scroller.className = "auto-component-pan";
          scroller.tabIndex = 0;
          scroller.setAttribute("role", "region");
          const spacer = document.createElement("div");
          scroller.append(spacer);
          foreign.append(scroller);
          root.append(foreign);
          const state: Preview = {
            block, label: root, foreign, scroller, spacer,
            originX: block.getRelativeToSurfaceXY().x, width: 0, contentWidth: 0,
            scroll: () => applyScroll(state),
            stop: event => event.stopPropagation(),
          };
          scroller.addEventListener("scroll", state.scroll);
          for (const type of ["pointerdown", "pointerup", "click", "keydown", "wheel"])
            scroller.addEventListener(type, state.stop);
          preview = state;
          previews.set(id, preview);
        }
        seen.add(id);
        preview.scroller.setAttribute("aria-label", `横向查看组件：${name(id)}`);
        const bounds = svg.getBoundingClientRect();
        const labelBounds = text.getBBox();
        const left = new DOMPoint(bounds.left + 14, root.getBoundingClientRect().top).matrixTransform(matrix.inverse()).x;
        preview.width = (bounds.width - 28) / scale;
        const offset = preview.originX - block.getRelativeToSurfaceXY().x;
        const naturalLeft = block.getSvgRoot().getBoundingClientRect().left + offset * scale;
        preview.contentWidth = Math.max(preview.width, (naturalLeft - bounds.left - 14) / scale + block.getHeightWidth().width);
        preview.foreign.setAttribute("x", String(left));
        preview.foreign.setAttribute("y", String(labelBounds.y));
        preview.foreign.setAttribute("width", String(preview.width));
        preview.foreign.setAttribute("height", String(18 / scale));
        preview.spacer.style.width = `${preview.contentWidth}px`;
        applyScroll(preview);
      }
      for (const id of previews.keys()) if (!seen.has(id)) remove(id);
    },
    dispose() { for (const id of previews.keys()) remove(id); },
  };
}
