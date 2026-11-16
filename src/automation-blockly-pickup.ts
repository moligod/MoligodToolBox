import * as Blockly from "blockly/core";

/** Palette blocks follow only a held pointer. Invalid drops revert the provisional clone. */
export function installFlyoutPickup(host: HTMLElement, workspace: Blockly.WorkspaceSvg) {
  let held: {pointer: number; palette: DOMRect} | undefined;
  const listeners = new AbortController();
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const clear = () => { held = undefined;  };
  const inside = (rect: DOMRect, e: PointerEvent) => e.clientX >= rect.left && e.clientX < rect.right && e.clientY >= rect.top && e.clientY < rect.bottom;
  function onCanvas(event: PointerEvent) {
    const panel = host.closest(".automation-layout")?.querySelector(".auto-toolbox");
    if (panel && inside(panel.getBoundingClientRect(), event)) return false;
    if (event.target instanceof Element && event.target.closest('.auto-toolbox, .auto-log-dock, .auto-canvas-tools')) return false;
    // Blockly hides the flyout when a native drag starts. Retain its original
    // footprint so releasing over that former palette cannot count as a drop.
    if (held && inside(held.palette,event)) return false;
    const background = host.querySelector(".blocklyMainBackground");
    if (!background || !inside(background.getBoundingClientRect(),event)) return false;
    return ![...host.querySelectorAll(".blocklyFlyout, .blocklyToolbox")].some(element =>
      element.getClientRects().length && inside(element.getBoundingClientRect(),event));
  }
  function cancel() {
    if (!held) return;
    const gesture = workspace.getGesture();
    const dragger = gesture?.getCurrentDragger();
    clear();
    // Deleting a provisional block calls Gesture.cancel(), which commits. Detach
    // the gesture first so reverting cannot recursively commit the same drag.
    gesture?.dispose();
    if (dragger && "onDragRevert" in dragger) dragger.onDragRevert(undefined, new Blockly.utils.Coordinate(0,0));
    Blockly.Events.setGroup(false);
  }
  function down(event: PointerEvent) {
    if (held) return;
    if (event.button !== 0 || event.pointerType !== "mouse" || workspace.isReadOnly()) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest(".blocklyFlyout")) return;
    const source = workspace.getFlyout()?.getWorkspace().getTopBlocks(false).find(block =>
      block.getSvgRoot().contains(target));
    if (!source?.isMovable()) return;
    held = {pointer:event.pointerId,palette:target.closest(".blocklyFlyout")!.getBoundingClientRect()};
  }
  function move(event: PointerEvent) {
    if (!held || event.pointerId !== held.pointer) return;
    if (!(event.buttons & 1)) {cancel(); return;}
    if (!workspace.getGesture()) {clear(); return;}
    if (!onCanvas(event)) {
      // Keep the provisional block following the pointer over the flyout,
      // without scrolling the workspace while the pointer is outside it.
      const gesture = workspace.getGesture()!;
      gesture.handleMove(event);
      const dragger = gesture.getCurrentDragger();
      if (dragger && "stopAutoScrolling" in dragger && typeof dragger.stopAutoScrolling === "function")
        dragger.stopAutoScrolling();
      stop(event);
    }
  }
  function up(event: PointerEvent) {
    if (!held || event.pointerId !== held.pointer) return;
    const gesture = workspace.getGesture();
    if (!gesture) {clear(); return;}
    if (!gesture.isDragging()) {clear(); return;}
    if (!onCanvas(event)) {stop(event);cancel();return;}
    // Let Blockly's pointerup complete snapping and the undo group.
    clear();
  }
  const options = {capture:true,signal:listeners.signal};
  document.addEventListener("pointerdown",down,options);
  document.addEventListener("pointermove",move,options);
  document.addEventListener("pointerup",up,options);
  document.addEventListener("pointercancel",cancel,options);
  document.addEventListener("keydown",event => {
    if (held && event.key === "Escape") {stop(event);cancel();}
  },options);
  return {
    active: () => !!held,
    cancel,
    dispose() {cancel();listeners.abort();},
  };
}
