import type { Step } from "./automation-editor";
import { parseBlocks } from "./automation-block-model.ts";

/** Make legacy input targets visible as separate focus steps without editing the source. */
export function explicitInputWindows(source: Step[]): Step[] {
  parseBlocks(source);
  let count = 0;
  function convert(steps: Step[]): Step[] {
    const result: Step[] = [];
    for (const step of steps) {
      if (step.action.type === "group") {
        step.action.steps = convert(step.action.steps as Step[]);
      } else {
        if (["key", "text"].includes(step.action.type) && "target" in step.action) {
          const target = step.action.target;
          if (target != null && typeof target !== "string")
            throw new Error("旧输入动作的目标窗口无效，原脚本已保留");
          if (target) {
            result.push({
              delayMs: step.delayMs ?? 0,
              ...(step.randomDelayMs === undefined ? {} : { randomDelayMs: step.randomDelayMs }),
              action: { type: "focus", target },
            });
            count++;
            step.delayMs = 0;
            if (step.randomDelayMs !== undefined) step.randomDelayMs = 0;
          }
          delete step.action.target;
        }
        if (++count > 1000)
          throw new Error("旧输入动作转换后超过1000个动作，原脚本已保留，请先减少动作数量");
      }
      result.push(step);
    }
    return result;
  }
  return convert(structuredClone(source));
}
