import * as Blockly from "blockly/core";

/** Close parameter warnings after the pointer spends three seconds outside. */
export function installWarningDismissal(workspace: Blockly.WorkspaceSvg, notify: (text: string, error?: boolean) => void) {
  const active = new Map<string, () => void>();
  const onChange = (event: Blockly.Events.Abstract) => {
    if (event.type === Blockly.Events.BLOCK_DELETE) {
      for (const id of (event as Blockly.Events.BlockDelete).ids ?? []) active.get(id)?.();
      return;
    }
    if (event.type !== Blockly.Events.BUBBLE_OPEN) return;
    const { blockId, bubbleType, isOpen } = event as Blockly.Events.BubbleOpen;
    if (bubbleType !== "warning" || !blockId) return;
    active.get(blockId)?.();
    if (!isOpen) return;
    const icon = workspace.getBlockById(blockId)?.getIcon(Blockly.icons.WarningIcon.TYPE);
    const root = icon?.getBubble()?.getSvgRoot();
    if (!icon || !root) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => { clearTimeout(timer); timer = undefined; };
    const stop = () => {
      cancel();
      root.removeEventListener("pointerenter", cancel);
      root.removeEventListener("pointerleave", start);
      active.delete(blockId);
    };
    const start = () => {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        if (root.isConnected && root.matches(":hover")) return;
        stop();
        if (!root.isConnected || icon.getBubble()?.getSvgRoot() !== root) return;
        void icon.setBubbleVisible(false).catch(reason => notify("警告提示关闭失败：" + String(reason), true));
      }, 3000);
    };
    root.addEventListener("pointerenter", cancel);
    root.addEventListener("pointerleave", start);
    active.set(blockId, stop);
    if (!root.matches(":hover")) start();
  };
  workspace.addChangeListener(onChange);
  return () => {
    workspace.removeChangeListener(onChange);
    for (const stop of active.values()) stop();
  };
}
