import type { Script, Step } from "./automation-editor";
import type { ValueBlock } from "./automation-values";

export function validScale(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 50 && value <= 1000;
}
export function scaleAction(action: Step["action"], ratio: number) {
  if (action.type === "click" && action.position !== undefined) return;
  const fields = action.type === "drag" ? ["fromX","fromY","toX","toY"]
    : ["click","scroll"].includes(action.type) ? ["x","y"] : [];
  for (const key of fields) {
    const value = action[key];
    if (typeof value === "number" && value >= 0) action[key] = Math.round(value * ratio);
  }
  for (const key of ["region"]) {
    const region = action[key] as Record<string, number> | undefined;
    if (!region) continue;
    for (const field of ["x","y","width","height"]) {
      if (region[field] > 0) region[field] = Math.max(1, Math.round(region[field] * ratio));
    }
  }
}
export function rescaleScript(script: Script, scale: number) {
  if (!validScale(scale) || !validScale(script.缩放)) throw new Error("缺少有效的原始缩放，无法自动换算坐标");
  const ratio = scale / script.缩放;
  const value=(v:ValueBlock)=>{
    if(v.kind==="query") scaleAction(v.action,ratio);
    if(v.kind==="binary") {value(v.left);value(v.right);}
    if(v.kind==="not") value(v.value);
  };
  const visit = (steps: Step[]) => {
    for (const step of steps) {
      scaleAction(step.action, ratio);
      Object.values(step.inputs?.values??{}).forEach(value);
      if (step.action.type === "group") visit(step.action.steps as Step[]);
    }
  };
  visit(script.steps);
  script.缩放 = scale;
}

export function confirmScale(script: Script, current: number, confirm: (message: string) => boolean): boolean {
  if (!validScale(script.缩放) || !validScale(current)) throw new Error("缺少有效的原始缩放，无法自动换算坐标");
  if (script.缩放 === current) return true;
  if (!confirm(`检测到脚本使用者缩放不一样（${script.缩放}% → ${current}%），是否修改成对应位置？取消则不继续。`)) return false;
  rescaleScript(script, current);
  return true;
}
