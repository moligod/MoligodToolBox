import * as Blockly from "blockly/core";
import { encodeNodes, START_BLOCK, workspaceToScript, type BlockState } from "./automation-blockly-codec.ts";
import { newBlock, parseBlocks } from "./automation-block-model.ts";
import { rescaleScript, validScale } from "./automation-scale.ts";
import type { Script } from "./automation-editor";
export interface Component { id: string; name: string; block: BlockState; scale?: number }

export function validateComponentImport(text: string): void {
  const library = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (library.schemaVersion !== 1 || !Array.isArray(library.components) || library.components.length > 100)
    throw new Error("组件库版本不支持或数量过多");
  for (const item of library.components) {
    workspaceToScript([{type:START_BLOCK, inputs:{BODY:{block:item.block}}}]);
    const preview = new Blockly.Workspace();
    const recordUndo = Blockly.Events.getRecordUndo();
    const group = Blockly.Events.getGroup();
    try {
      Blockly.serialization.blocks.append(item.block, preview);
    } finally {
      preview.dispose();
      // Blockly's append restores these globals only on a successful decode.
      Blockly.Events.setRecordUndo(recordUndo);
      Blockly.Events.setGroup(group);
    }
  }
}

/** Snapshot selected roots, retaining nested actions and values without unrelated siblings. */
export function componentState(roots: Blockly.Block[], name: string): BlockState {
  if (!roots.length) throw new Error("请先在画布中选中要保存的动作");
  let chain: BlockState | undefined;
  for (const root of [...roots].reverse()) {
    const state = Blockly.serialization.blocks.save(root, { addNextBlocks: false, saveIds: false }) as BlockState | null;
    if (!state) throw new Error("无法读取选中的动作");
    if (chain) state.next = { block: chain };
    chain = state;
  }
  const steps = workspaceToScript([{type:START_BLOCK, inputs:{BODY:{block:chain}}}]);
  return encodeNodes([newBlock({ delayMs: 0, action: { type: "group", name, steps } })])!;
}
export function scaledComponent(item: Component, scale: number | undefined): BlockState {
  if (!validScale(item.scale) || !validScale(scale)) throw new Error("缺少组件或当前任务的缩放，无法安全放置组件");
  if (item.scale === scale) return structuredClone(item.block);
  const steps = workspaceToScript([{type:START_BLOCK, inputs:{BODY:{block:item.block}}}]);
  const script: Script = {schemaVersion:2,name:item.name,repeats:1,maxRunSeconds:60,startDelayMs:0,steps,缩放:item.scale};
  rescaleScript(script, scale);
  return encodeNodes(parseBlocks(script.steps))!;
}
