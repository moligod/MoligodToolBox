import type { Step } from "./automation-editor";
export type Path = number[];
function container(root: Step[], path: Path) {
  let current = root;
  for (const index of path) {
    const action = current[index]?.action;
    if (action?.type !== "group" || !Array.isArray(action.steps))
      throw new Error("动作组路径无效");
    current = action.steps as Step[];
  }
  return current;
}
function parent(root: Step[], path: Path) {
  if (!path.length) throw new Error("动作路径为空");
  return container(root, path.slice(0, -1));
}
function find(root: Step[], target: Step, path: Path = []): Path | null {
  for (let index = 0; index < root.length; index++) {
    const item = root[index],
      next = [...path, index];
    if (item === target) return next;
    if (item.action.type === "group" && Array.isArray(item.action.steps)) {
      const found = find(item.action.steps as Step[], target, next);
      if (found) return found;
    }
  }
  return null;
}
export function moveStep(
  source: Step[],
  from: Path,
  to: Path,
  where: "before" | "after" | "inside",
): Step[] {
  const root = structuredClone(source);
  const list = parent(root, from),
    step = list[from[from.length - 1]];
  const target = parent(root, to)[to[to.length - 1]];
  if (!step || !target) throw new Error("动作位置不存在");
  if (from.length <= to.length && from.every((index, i) => to[i] === index))
    throw new Error("不能将组移动到自身内部");
  if (
    where === "inside" &&
    (target.action.type !== "group" || !Array.isArray(target.action.steps))
  )
    throw new Error("目标不是动作组");
  list.splice(from[from.length - 1], 1);
  const newTarget = find(root, target);
  if (!newTarget) throw new Error("目标动作已移除");
  if (where === "inside") container(root, newTarget).push(step);
  else
    parent(root, newTarget).splice(
      newTarget[newTarget.length - 1] + (where === "after" ? 1 : 0),
      0,
      step,
    );
  return root;
}
export function groupSelected(
  source: Step[],
  selected: number[],
  name: string,
): Step[] {
  if (!name.trim() || name.length > 64 || !selected.length)
    throw new Error("请选中步骤并填写分组名称");
  const root = structuredClone(source);
  const indexes = [...new Set(selected)].sort((a, b) => a - b);
  if (indexes.some((index) => index < 0 || index >= root.length))
    throw new Error("选中步骤已变化");
  if (indexes.some((index, i) => i > 0 && index !== indexes[i - 1] + 1))
    throw new Error("请连续选择步骤，避免改变执行顺序");
  const children = indexes.map((index) => root[index]);
  for (const index of [...indexes].reverse()) root.splice(index, 1);
  root.splice(indexes[0], 0, {
    delayMs: 0,
    action: { type: "group", name, steps: children },
  });
  return root;
}
