import type { Step } from "./automation-editor";
export type BlockPath = number[];
export interface BlockBranch {
  head?: Step;
  index?: number;
  blocks: Block[];
}
export interface Block {
  collapsed?: boolean;
  step: Step;
  index?: number;
  tail?: Step;
  tailIndex?: number;
  branches?: BlockBranch[];
}
export function parseBlocks(steps: Step[]): Block[] {
  let execution = 0;
  function parse(items: Step[], depth: number): Block[] {
    if (depth > 32) throw new Error("积木嵌套超过32层");
    let at = 0;
    function sequence(stop: string[] = [], level = depth): Block[] {
      if (level > 32) throw new Error("积木嵌套超过32层");
      const result: Block[] = [];
      while (at < items.length && !stop.includes(items[at].action.type)) {
        const step = items[at++],
          type = step.action.type;
        if (["ocrGroup", "setFromOcr"].includes(type))
          throw new Error("脚本包含已移除的两处文字识别或取成组 OCR 值动作，原脚本未修改。请改用读取屏幕文字。");
        const node: Block = { step };
        if (type === "group") {
          if (!Array.isArray(step.action.steps))
            throw new Error("动作组内容无效");
          node.branches = [
            { blocks: parse(step.action.steps as Step[], level + 1) },
          ];
        } else {
          node.index = execution++;
          if (["loop", "if", "waitUntil"].includes(type)) {
            if (level > 31) throw new Error("积木嵌套超过32层");
            const tail = type === "loop" ? "endLoop" : type === "waitUntil" ? "endWaitUntil" : "endIf";
            const stops = type === "if" ? ["elseIf", "else", tail] : [tail];
            node.branches = [{ blocks: sequence(stops, level + 1) }];
            let hadElse = false;
            while (
              type === "if" &&
              at < items.length &&
              ["elseIf", "else"].includes(items[at].action.type)
            ) {
              if (hadElse) throw new Error("否则分支后不能再添加条件");
              const head = items[at++];
              hadElse = head.action.type === "else";
              node.branches.push({
                head,
                index: execution++,
                blocks: sequence(stops, level + 1),
              });
            }
            if (items[at]?.action.type !== tail)
              throw new Error("控制积木缺少结束步骤，请补齐结束步骤");
            node.tail = items[at++];
            node.tailIndex = execution++;
          } else if (["endLoop", "endWaitUntil", "endIf", "elseIf", "else"].includes(type)) {
            throw new Error("控制积木开始与结束不匹配");
          }
        }
        result.push(node);
      }
      return result;
    }
    return sequence();
  }
  return parse(steps, 0);
}
export function writeBlocks(blocks: Block[]): Step[] {
  return blocks.flatMap((block) => {
    if (!block.branches) return [structuredClone(block.step)];
    if (block.step.action.type === "group")
      return [
        {
          ...structuredClone(block.step),
          action: {
            ...structuredClone(block.step.action),
            steps: writeBlocks(block.branches[0].blocks),
          },
        },
      ];
    return [
      structuredClone(block.step),
      ...block.branches.flatMap((branch) => [
        ...(branch.head ? [structuredClone(branch.head)] : []),
        ...writeBlocks(branch.blocks),
      ]),
      structuredClone(block.tail!),
    ];
  });
}
export function blockList(root: Block[], path: BlockPath): Block[] {
  let list = root;
  if (path.length % 2) throw new Error("积木槽位无效");
  for (let i = 0; i < path.length; i += 2) {
    const branch = list[path[i]]?.branches?.[path[i + 1]];
    if (!branch) throw new Error("积木槽位不存在");
    list = branch.blocks;
  }
  return list;
}
export function moveBlock(
  source: Block[],
  from: BlockPath,
  destination: BlockPath,
  position: number,
): Block[] {
  if (
    !from.length ||
    from.length % 2 !== 1 ||
    destination.length % 2 ||
    from.some((n) => !Number.isInteger(n) || n < 0) ||
    destination.some((n) => !Number.isInteger(n) || n < 0)
  )
    throw new Error("积木位置无效");
  if (
    destination.length >= from.length &&
    from.every((n, i) => destination[i] === n)
  )
    throw new Error("不能将积木放入自身内部");
  const root = structuredClone(source),
    origin = blockList(root, from.slice(0, -1)),
    target = blockList(root, destination);
  const index = from[from.length - 1];
  if (
    !origin[index] ||
    !Number.isInteger(position) ||
    position < 0 ||
    position > target.length
  )
    throw new Error("积木位置不存在");
  const [node] = origin.splice(index, 1);
  target.splice(
    origin === target && position > index ? position - 1 : position,
    0,
    node,
  );
  return root;
}
export function newBlock(step: Step): Block {
  const node: Block = { step: structuredClone(step) };
  if (step.action.type === "group")
    node.branches = [{ blocks: parseBlocks(step.action.steps as Step[]) }];
  if (["loop", "if", "waitUntil"].includes(step.action.type)) {
    node.branches = [{ blocks: [] }];
    node.tail = {
      delayMs: 0,
      action: { type: step.action.type === "loop" ? "endLoop" : step.action.type === "waitUntil" ? "endWaitUntil" : "endIf" },
    };
  }
  return node;
}

export function bindingBefore(
  nodes: Block[],
  step: Step | undefined,
  slot: string,
) {
  let title: string | undefined,
    before = true,
    dynamic = false;
  function visit(list: Block[]) {
    for (const node of list) {
      if (node.step === step) before = false;
      const a = node.step.action;
      if (a.type === "setWindow" && a.target === slot) {
        dynamic = true;
        if (before) title = String(a.title ?? "");
      }
      node.branches?.forEach((branch) => visit(branch.blocks));
    }
  }
  visit(nodes);
  return { title, dynamic };
}
