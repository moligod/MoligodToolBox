import type { Step } from "./automation-editor";
import { parseBlocks, type Block } from "./automation-block-model.ts";
import {
  actionSlots,
  fallbackValue,
  VALUE_BLOCK,
  requiredInputVersion,
  valueType,
  type ValueBlock,
  type ValueType,
} from "./automation-values.ts";

export interface ActionState {
  step: Step;
  tail?: Step;
  branches?: { key: string; head?: Step }[];
}
export interface BlockState {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  extraState?: Partial<ActionState> & { value?: ValueBlock };
  inputs?: Record<string, { block?: BlockState; shadow?: BlockState }>;
  next?: { block?: BlockState };
}
export const ACTION_BLOCK = "moligod_action";
export const START_BLOCK = "moligod_start";

function validateSelector(value: ValueBlock) {
  if (value.kind === "selector" && (!Object.keys(value).every(key => ["kind","mode","value"].includes(key)) || !(
    (value.mode === "number" && typeof value.value === "number" && Number.isFinite(value.value)) ||
    ((value.mode === "string" || value.mode === "variable") && typeof value.value === "string")
  ))) throw new Error("取值积木内容无效，原数据已保留");
}

export function encodeValue(value: ValueBlock, depth = 0): BlockState {
  if (
    depth > 16 ||
    !["literal", "variable", "selector", "expression", "binary", "not", "query"].includes(
      value.kind,
    )
  )
    throw new Error("取值积木无法读取，原数据已保留");
  validateSelector(value);
  const state: BlockState = {
    type: VALUE_BLOCK,
    extraState: { value: structuredClone(value) },
  };
  const operand = (child: ValueBlock, expected: ValueType = "any") => {
    const type = (child.kind === "selector" && child.mode === "variable") || (child.kind === "query" && child.action.type === "ocr" && child.action.numericResult === true && child.action.numbersOnly === true) ? expected : valueType(child);
    return child.kind === "literal"
      ? { shadow: encodeValue(child, depth + 1) }
      : {
          shadow: encodeValue(
            {
              kind: "literal",
              value:
                type === "number"
                  ? 0
                  : type === "boolean"
                    ? true
                    : type === "string"
                      ? ""
                      : null,
            },
            depth + 1,
          ),
          block: encodeValue(child, depth + 1),
        };
  };
  if (value.kind === "binary") {
    const expected = ["&&", "||"].includes(value.op) ? "boolean" : ["==", "!="].includes(value.op) ? "any" : "number";
    const condition = (child: ValueBlock) => child.kind === "literal"
      ? operand(child, expected)
      : { block: encodeValue(child, depth + 1) };
    state.inputs = {
      LEFT: expected === "boolean" ? condition(value.left) : operand(value.left, expected),
      RIGHT: expected === "boolean" ? condition(value.right) : operand(value.right, expected),
    };
  }
  if (value.kind === "not") state.inputs = { VALUE: operand(value.value, "boolean") };
  return state;
}
export function decodeValue(
  block: BlockState | undefined,
  depth = 0,
): ValueBlock {
  if (
    depth > 16 ||
    !block ||
    block.type !== VALUE_BLOCK ||
    !block.extraState?.value
  )
    throw new Error("取值积木缺失或嵌套超过16层，请补全后保存");
  const value = structuredClone(block.extraState.value);
  validateSelector(value);
  const child = (key: string) =>
    decodeValue(
      block.inputs?.[key]?.block ?? block.inputs?.[key]?.shadow,
      depth + 1,
    );
  if (value.kind === "binary") {
    if (["&&", "||"].includes(value.op) &&
      (!block.inputs?.LEFT || !block.inputs?.RIGHT))
      throw new Error("请在“且/或”左右放入条件，再保存或运行。");
    value.left = child("LEFT");
    value.right = child("RIGHT");
  }
  if (value.kind === "not") value.value = child("VALUE");
  return value;
}
function encodeSlots(state: BlockState, step: Step, prefix = "") {
  if (
    step.inputs &&
    (![1,2,3].includes(step.inputs.schemaVersion) ||
      Object.values(step.inputs.values).some(value => requiredInputVersion(value) > step.inputs!.schemaVersion) ||
      !Object.keys(step.inputs.values).length ||
      Object.keys(step.inputs.values).some(
        (key) => !actionSlots(step).some((slot) => slot.key === key),
      ))
  )
    throw new Error("不支持的取值积木版本或插槽，原数据已保留");
  for (const { key } of actionSlots(step)) {
    if(key==="expression") {
      const value=step.inputs?.values[key] ?? (String(step.action.expression??"").trim() ? fallbackValue(step,key) : undefined);
      if(value) (state.inputs??={})[prefix+"VALUE_"+key]={block:encodeValue(value)};
      continue;
    }
    const fallback = encodeValue(fallbackValue(step, key));
    (state.inputs ??= {})[prefix + "VALUE_" + key] = {
      shadow: fallback,
      ...(step.inputs?.values[key]
        ? { block: encodeValue(step.inputs.values[key]) }
        : {}),
    };
  }
}
export function decodeSlots(state: BlockState, step: Step, prefix = "") {
  const originalInputs = step.inputs;
  delete step.inputs;
  for (const { key, type } of actionSlots(step)) {
    const slot = state.inputs?.[prefix + "VALUE_" + key];
    const block = slot?.block ?? slot?.shadow;
    // Older saved Blockly states had fields on the action itself.
    if (!slot) {
      if(key==="expression") throw new Error("请在动作的空插槽放入条件或取值积木，再保存或运行。");
      continue;
    }
    const value = decodeValue(block);
    if (type !== "any" && valueType(value) !== type && !(value.kind === "selector" && value.mode === "variable") && !(value.kind === "query" && value.action.type === "ocr" && value.action.numericResult === true && value.action.numbersOnly === true))
      throw new Error("取值与动作插槽类型不匹配");
    if(key==="expression" && value.kind==="expression" && !originalInputs?.values.expression) {
      if(JSON.stringify(value)!==JSON.stringify(fallbackValue(step,key))) {
        step.action.expression=value.source;
        if(step.action.type==="assert") step.action.stopWhenTrue=true;
      }
      continue;
    }
    if (
      !slot?.block &&
      JSON.stringify(value) === JSON.stringify(fallbackValue(step, key))
    )
      continue;
    if (
      step.action.type === "assert" &&
      key === "expression" &&
      !originalInputs?.values.expression
    )
      step.action.stopWhenTrue = true;
    if (key === "seconds" && slot.block && !originalInputs?.values.seconds) {
      step.action.ms = Number(step.action.ms) + (step.delayMs || 0);
      step.delayMs = 0;
    }
    if (
      !slot?.block &&
      (value.kind === "literal" || value.kind === "expression")
    ) {
      if (key === "seconds") {
        step.action.ms = Math.round(
          Number(value.kind === "literal" ? value.value : 0) * 1000,
        );
        step.delayMs = 0;
      } else
        step.action[key] =
          value.kind === "literal" ? value.value : value.source;
    } else
      {
        const inputs = step.inputs ??= { schemaVersion: originalInputs?.schemaVersion ?? 1, values: {} };
        inputs.schemaVersion = Math.max(inputs.schemaVersion, requiredInputVersion(value)) as 1 | 2 | 3;
        inputs.values[key] = value;
      }
  }
}

export function encodeNodes(nodes: Block[]): BlockState | undefined {
  let next: BlockState | undefined;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const step = structuredClone(node.step);
    if (node.branches && step.action.type === "group") step.action.steps = [];
    const state: BlockState = {
      type: ACTION_BLOCK,
      extraState: {
        step,
        ...(node.tail ? { tail: structuredClone(node.tail) } : {}),
        ...(node.branches
          ? {
              branches: node.branches.map((b, index) => ({
                key: String(index),
                ...(b.head ? { head: structuredClone(b.head) } : {}),
              })),
            }
          : {}),
      },
    };
    encodeSlots(state, step);
    state.extraState!.branches?.forEach((branch) => {
      if (branch.head)
        encodeSlots(state, branch.head, "BRANCH_" + branch.key + "_");
    });
    node.branches?.forEach((branch, index) => {
      const child = encodeNodes(branch.blocks);
      if (child) (state.inputs ??= {})["BODY_" + index] = { block: child };
    });
    if (next) state.next = { block: next };
    next = state;
  }
  return next;
}

export function scriptToWorkspace(steps: Step[]) {
  const body = encodeNodes(parseBlocks(steps));
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: START_BLOCK,
          id: "moligod-start",
          x: 32,
          y: 28,
          ...(body ? { inputs: { BODY: { block: body } } } : {}),
        },
      ],
    },
  };
}

/** Decode only connected statements. Never drop an unconnected stack on save/run. */
export function workspaceToScript(states: BlockState[]): Step[] {
  if (states.length !== 1 || states[0].type !== START_BLOCK)
    throw new Error(
      "有未连接的积木，请先接到“任务开始”再保存、运行或切换任务。",
    );
  let count = 0;
  function chain(first: BlockState | undefined, depth: number): Step[] {
    if (depth > 32) throw new Error("积木嵌套超过32层");
    const steps: Step[] = [];
    for (let block = first; block; block = block.next?.block) {
      if (++count > 1000) throw new Error("动作数量超过1000");
      if (block.type !== ACTION_BLOCK || !block.extraState?.step)
        throw new Error("无法读取积木，原脚本未覆盖");
      const { step, tail, branches } = structuredClone(
        block.extraState,
      ) as ActionState;
      decodeSlots(block, step);
      branches?.forEach((branch) => {
        if (branch.head)
          decodeSlots(block, branch.head, "BRANCH_" + branch.key + "_");
      });
      if (branches && step.action.type === "group") {
        step.action.steps = chain(
          block.inputs?.["BODY_" + branches[0].key]?.block,
          depth + 1,
        );
        steps.push(step);
      } else {
        steps.push(step);
        branches?.forEach((branch) => {
          if (branch.head) steps.push(branch.head);
          steps.push(
            ...chain(block.inputs?.["BODY_" + branch.key]?.block, depth + 1),
          );
        });
        if (tail) steps.push(tail);
      }
    }
    return steps;
  }
  const result = chain(states[0].inputs?.BODY?.block, 0);
  parseBlocks(result);
  return result;
}
