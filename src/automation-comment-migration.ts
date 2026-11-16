import type { Step } from "./automation-editor";
import {
  parseBlocks,
  writeBlocks,
  type Block,
} from "./automation-block-model.ts";

/** Materialize the old visual notes without modifying the loaded source data. */
export function standaloneComments(steps: Step[]): Step[] {
  const nodes = parseBlocks(structuredClone(steps));
  const encoder = new TextEncoder();
  function take(step: Step | undefined): Block[] {
    if (!step || typeof step.annotation !== "string" || !step.annotation)
      return [];
    const chunks: string[] = [];
    let chunk = "",
      bytes = 0;
    for (const character of step.annotation) {
      const size = encoder.encode(character).length;
      if (bytes + size > 4096) {
        chunks.push(chunk);
        chunk = "";
        bytes = 0;
      }
      chunk += character;
      bytes += size;
    }
    if (chunk) chunks.push(chunk);
    delete step.annotation;
    return chunks.map((text) => ({
      step: { delayMs: 0, action: { type: "comment", text } },
    }));
  }
  function convert(items: Block[]): Block[] {
    return items.flatMap((node) => {
      const notes = take(node.step);
      if (!node.branches) return [node, ...notes];
      node.branches.forEach((branch) => {
        branch.blocks = [...take(branch.head), ...convert(branch.blocks)];
      });
      node.branches[0].blocks.unshift(...notes);
      node.branches[node.branches.length - 1].blocks.push(...take(node.tail));
      return [node];
    });
  }
  const result = writeBlocks(convert(nodes));
  let count = 0;
  function check(items: Step[]) {
    for (const step of items) {
      if (step.action.type === "group") check(step.action.steps as Step[]);
      else if (++count > 1000)
        throw new Error(
          "旧注解转换后超过1000个动作，原脚本已保留，请先减少动作数量",
        );
    }
  }
  check(result);
  return result;
}
