import type { utils } from "blockly/core";
import { actionDraft } from "./automation-action-draft.ts";
import { newBlock } from "./automation-block-model.ts";
import { encodeNodes, encodeValue } from "./automation-blockly-codec.ts";
import type { ValueBlock } from "./automation-values.ts";

export interface ActionCategory {
  id?: string;
  label: string;
  actions: { type: string; name: string }[];
}

// Shared by the palette sections and blocks in the workspace.
export const flowGroups = [
  {
    name: "条件判断",
    colour: "#8d6b32",
    actions: [
      "if",
      "elseIf",
      "else",
      "endIf",
      "assert",
      "stop",
      "holdUntil",
      "waitUntil",
      "endWaitUntil",
    ],
  },
  {
    name: "循环",
    colour: "#426b92",
    actions: ["loop", "endLoop", "break", "continue"],
  },
  { name: "跳转", colour: "#7b5b8f", actions: ["label", "goto"] },
];

/** Flyout templates use the same incomplete drafts and container boundaries as insertion. */
export function actionToolbox(
  categories: ActionCategory[],
): utils.toolbox.ToolboxInfo {
  const colours = ["#557c55", "#39738d", "#327b74", "#6e629e", "#8d6b32"];
  return {
    kind: "categoryToolbox",
    contents: categories
      .map(category => {
        let keyboard = false;
        return {...category, actions: category.actions
          .filter(action => !["set", "calculate", "comment", "holdUntil", "waitUntil", "endWaitUntil"].includes(action.type))
          .flatMap(action => {
            if (["key", "keyDown", "keyUp"].includes(action.type)) {
              if (keyboard) return [];
              keyboard = true;
              return [{type:"key", name:"按键"}];
            }
            return [action.type === "assert" ? {type:"stop", name:"停止任务"} : action];
          })};
      })
      .filter((category) => category.actions.length)
      .map((category, index) => ({
        kind: "category",
        name: category.label,
        colour: category.id === "flow" ? "#8d6b32" : colours[index % colours.length],
        contents: paletteContents(category),
      }))
      .concat([
        {
          kind: "category",
          name: "条件与取值",
          colour: "#8d6b32",
          contents: valuePalette(),
        },
        {kind:"category", name:"组件库", colour:"#739456", custom:"MOLIGOD_COMPONENTS"} as unknown as {kind:string;name:string;colour:string;contents:utils.toolbox.FlyoutItemInfo[]},
      ]),
  };
}

function paletteContents(
  category: ActionCategory,
): utils.toolbox.FlyoutItemInfo[] {
  const block = (
    action: ActionCategory["actions"][number],
  ): utils.toolbox.BlockInfo => ({
    kind: "block",
    ...encodeNodes([newBlock(actionDraft(action.type))])!,
    gap: 24,
  });
  if (category.id !== "flow") return category.actions.map(block);
  const contents: utils.toolbox.FlyoutItemInfo[] = [];
  for (const group of flowGroups) {
    const actions = category.actions.filter((action) =>
      group.actions.includes(action.type),
    );
    if (!actions.length) continue;
    if (contents.length) contents.push({ kind: "sep", gap: 16 });
    contents.push({ kind: "label", text: group.name });
    contents.push(...actions.map(block));
  }
  contents.push(
    ...category.actions
      .filter(
        (action) =>
          !flowGroups.some((group) => group.actions.includes(action.type)),
      )
      .map(block),
  );
  return contents;
}

export function valuePalette(): utils.toolbox.FlyoutItemInfo[] {
  const literal = (value: unknown): ValueBlock => ({ kind: "literal", value });
  const variable: ValueBlock = {
    kind: "selector",
    mode: "variable",
    value: "result",
  };
  const values: ValueBlock[] = [
    { kind: "binary", op: ">", left: variable, right: { kind: "selector", mode: "number", value: 0 }, strictEquality: true },
    { kind: "binary", op: "&&", left: literal(true), right: literal(true) },
    { kind: "binary", op: "+", left: literal(1), right: literal(1) },
    { kind: "selector", mode: "number", value: 1 },
  ];
  const template = (value: ValueBlock): utils.toolbox.BlockInfo => {
    const state = encodeValue(value);
    if (value.kind === "binary" && ["&&", "||"].includes(value.op))
      delete state.inputs;
    return { kind: "block", ...state, gap: 20 } as utils.toolbox.BlockInfo;
  };
  const contents: utils.toolbox.FlyoutItemInfo[] = [
    {kind:"block",...encodeNodes([newBlock(actionDraft("set"))])!,gap:24} as utils.toolbox.BlockInfo,
    ...values.map(template),
    template({ kind: "expression", source: "result > 0", valueType: "boolean" }),
    template({ kind: "expression", source: "1+1", valueType: "number" }),
  ];
  return contents;
}
