import * as Blockly from "blockly/core";
import { ACTION_BLOCK, START_BLOCK } from "./automation-blockly-codec.ts";
import type { ActionBlock } from "./automation-blockly-blocks.ts";

type Action = Blockly.BlockSvg & ActionBlock;
type Candidate = { connection: Blockly.RenderedConnection; x: number; y: number };

/** A selected container carries its contents; selected descendants are not detached twice. */
export function selectedRoots(workspace: Blockly.WorkspaceSvg, ids: Set<string>): Action[] {
  const ordered: Action[] = [];
  function visit(first: Blockly.Block | null) {
    for (let current = first; current; current = current.getNextBlock()) {
      if (current.type !== ACTION_BLOCK) continue;
      const action = current as Action;
      if (ids.has(action.id)) ordered.push(action);
      for (const branch of action.readState().branches ?? []) visit(action.getInputTargetBlock("BODY_" + branch.key));
    }
  }
  for (const root of workspace.getTopBlocks(true)) visit(root.type === START_BLOCK ? root.getInputTargetBlock("BODY") : root);
  return ordered.filter(block => {
    for (let parent = block.getSurroundParent(); parent; parent = parent.getSurroundParent()) if (ids.has(parent.id)) return false;
    return true;
  });
}

function belongsTo(block: Blockly.Block, roots: Set<string>) {
  for (let parent: Blockly.Block | null = block; parent; parent = parent.getSurroundParent()) if (roots.has(parent.id)) return true;
  return false;
}

export function stackOffsets(roots: Action[]) {
  const offsets = [{x:0,y:0}];
  for (let i = 1; i < roots.length; i++) {
    const bottom = roots[i - 1].nextConnection!.getOffsetInBlock(), top = roots[i].previousConnection!.getOffsetInBlock();
    offsets.push({x:offsets[i - 1].x + bottom.x - top.x, y:offsets[i - 1].y + bottom.y - top.y});
  }
  return offsets;
}

/** Keep the grabbed action under the pointer when disjoint actions form a stack. */
export function dragAdjustment(workspace: Blockly.WorkspaceSvg, roots: Action[], grabbed: Blockly.Block) {
  const index = roots.findIndex(root => belongsTo(grabbed, new Set([root.id])));
  if (index < 0) return {x:0,y:0};
  const head = roots[0].getRelativeToSurfaceXY(), position = roots[index].getRelativeToSurfaceXY(), offset = stackOffsets(roots)[index];
  return {x:(position.x - head.x - offset.x) * workspace.scale, y:(position.y - head.y - offset.y) * workspace.scale};
}

/** Snap the first selected action's top connection to an existing statement connection. */
export function closestInsertion(workspace: Blockly.WorkspaceSvg, roots: Action[], dx: number, dy: number): Candidate | undefined {
  const head = roots[0];
  const matrix = workspace.getCanvas().getScreenCTM();
  if (!head?.previousConnection || !matrix) return;
  const origin = head.getRelativeToSurfaceXY(), offset = head.previousConnection.getOffsetInBlock();
  const desired = new DOMPoint(origin.x + offset.x, origin.y + offset.y).matrixTransform(matrix);
  desired.x += dx; desired.y += dy;
  const moving = new Set(roots.map(block => block.id));
  let best: Candidate | undefined, distance = 45;
  for (const block of workspace.getAllBlocks(false)) {
    if ((block.type !== ACTION_BLOCK && block.type !== START_BLOCK) || block.isInsertionMarker() || !block.getSvgRoot().getClientRects().length || belongsTo(block, moving)) continue;
    const connections = [block.nextConnection, ...block.inputList.filter(input => input.name === "BODY" || input.name.startsWith("BODY_")).map(input => input.connection)];
    if (block.isCollapsed()) connections.splice(1);
    const position = block.getRelativeToSurfaceXY();
    for (const raw of connections) {
      const connection = raw as Blockly.RenderedConnection | null;
      if (!connection) continue;
      const point = connection.getOffsetInBlock();
      const screen = new DOMPoint(position.x + point.x, position.y + point.y).matrixTransform(matrix);
      const next = Math.hypot(screen.x - desired.x, screen.y - desired.y);
      if (next < distance) { distance = next; best = { connection, x: screen.x, y: screen.y }; }
    }
  }
  return best;
}

/** Commit a whole move in one Blockly undo group, keeping all unselected statements connected. */
export function moveSelected(workspace: Blockly.WorkspaceSvg, roots: Action[], candidate: Candidate | undefined, dx: number, dy: number): void {
  if (roots.length < 1 || roots.some(block => !block.isMovable() || !block.previousConnection || !block.nextConnection)) throw new Error("选中的积木无法一起移动");
  const blocks = workspace.getAllBlocks(false).filter(block => block.type === ACTION_BLOCK) as Action[];
  const original = blocks.map(block => ({ block, parent: block.previousConnection?.targetConnection ?? null }));
  const positions = workspace.getTopBlocks(false).map(block => ({ block, point: block.getRelativeToSurfaceXY() }));
  const origin = roots[0].getRelativeToSurfaceXY();
  const group = Blockly.Events.getGroup();
  if (!group) Blockly.Events.setGroup(true);
  try {
    for (const block of [...roots].reverse()) block.unplug(true);
    for (let i = 1; i < roots.length; i++) {
      if (!roots[i - 1].nextConnection!.connect(roots[i].previousConnection!)) throw new Error("无法连接所选积木");
    }
    const head = roots[0], tail = roots[roots.length - 1];
    if (candidate) {
      const displaced = candidate.connection.targetConnection;
      if (displaced) candidate.connection.disconnect();
      if (!candidate.connection.connect(head.previousConnection!)) throw new Error("无法连接到目标位置");
      if (displaced && !tail.nextConnection!.connect(displaced)) throw new Error("无法保留目标位置后的积木");
    } else {
      const current = head.getRelativeToSurfaceXY();
      head.moveBy(origin.x + dx / workspace.scale - current.x, origin.y + dy / workspace.scale - current.y);
    }
  } catch (error) {
    // Recover the original statement tree if any connection fails midway.
    for (const { block } of original) if (block.previousConnection?.isConnected()) block.previousConnection.disconnect();
    for (const { block, parent } of original) if (parent && !parent.connect(block.previousConnection!)) throw new Error("恢复连接失败");
    for (const { block, point } of positions) {
      const now = block.getRelativeToSurfaceXY();
      block.moveBy(point.x - now.x, point.y - now.y);
    }
    throw error;
  } finally {
    if (!group) Blockly.Events.setGroup(false);
  }
}
