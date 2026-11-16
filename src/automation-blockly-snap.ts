import * as Blockly from "blockly/core";
import { VALUE_BLOCK } from "./automation-values.ts";

/** Use the visible value's width instead of requiring its left tip to align. */
export class ValueDragStrategy extends Blockly.dragging.BlockDragStrategy {
  protected override getSearchRadius() {
    const normal = super.getSearchRadius();
    return Number.isFinite(normal)
      ? normal + this.block.getHeightWidth().width / 2
      : normal;
  }
}

export class ValueConnectionChecker extends Blockly.ConnectionChecker {
  override doDragChecks(
    a: Blockly.RenderedConnection,
    b: Blockly.RenderedConnection,
    radius: number,
  ) {
    if (
      Number.isFinite(radius) &&
      a.type === Blockly.ConnectionType.OUTPUT_VALUE &&
      a.getSourceBlock().type === VALUE_BLOCK
    ) {
      const normal = Blockly.config.snapRadius;
      // Widen only along this row. Never evict a real value at the wider range.
      if (Math.abs(a.y - b.y) > normal) return false;
      const occupied = b.targetBlock();
      if (Math.abs(a.x - b.x) > normal && occupied && !occupied.isShadow())
        return false;
    }
    return super.doDragChecks(a, b, radius);
  }
}
