import * as Blockly from "blockly/core";
import * as Chinese from "blockly/msg/zh-hans";
import {
  ACTION_BLOCK,
  START_BLOCK,
  type ActionState,
  encodeValue,
} from "./automation-blockly-codec.ts";
import {
  formatKeys,
  stepSummary,
  windowName,
} from "./automation-step-summary.ts";
import { registerValueBlocks, connectionType } from "./automation-blockly-values.ts";
import { actionSlots, fallbackValue, isStopAction, type ValueType } from "./automation-values.ts";
import { virtualKey } from "./hotkey-capture.ts";
import type { Step } from "./automation-editor";
import { CommentField } from "./automation-blockly-comment.ts";
import { flowGroups } from "./automation-blockly-toolbox.ts";
import { TextField, WindowDropdown } from "./automation-blockly-fields.ts";

export const configuredActions = new Set([
  "click",
  "drag",
  "scroll",
  "ocr",
  "match",
  "capture",
]);

export interface BlockServices {
  names: Record<string, string>;
  windows: () => string[];
  slots: () => string[];
  configure: (block: ActionBlock) => void;
  editComment: (block: ActionBlock, value: string) => void;
  branch: (block: ActionBlock, kind: "elseIf" | "else" | "remove") => void;
  refresh: () => Promise<void>;
  saveComponent?: (block: ActionBlock) => void;
  tasks?: () => {id:string;name:string}[];
  refreshTasks?: () => Promise<{id:string;name:string}[]>;
}
export const services = new WeakMap<Blockly.Workspace, BlockServices>();
interface Binding {
  name: string;
  original: string;
  apply: (state: ActionState, value: string) => void;
}
export type ActionBlock = Blockly.BlockSvg & {
  payload: ActionState;
  bindings: Binding[];
  readState: () => ActionState;
  shape: (state: ActionState) => void;
};

/** Move one action (including its nested bodies), never the following siblings. */
class ActionDragStrategy extends Blockly.dragging.BlockDragStrategy {
  protected override shouldHealStack() {
    return true;
  }
}
const icons = (text: string, width = 28, fontSize = 17) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="24"><rect width="${width}" height="24" rx="4" fill="#ffffff22"/><text x="${width / 2}" y="17" text-anchor="middle" font-size="${fontSize}" fill="white">${text}</text></svg>`,
  );
const colors: Record<string, string> = {
  group: "#536e9a",
  ...Object.fromEntries(flowGroups.flatMap(group => group.actions.map(type => [type, group.colour]))),
  set: "#6e629e",
  calculate: "#6e629e",
  ocr: "#327b74",
  match: "#327b74",
  capture: "#327b74",
  comment: "#59616a",
};

export function parseKeys(text: string): number[] {
  const names: Record<string, number> = {
    CTRL: 17,
    CONTROL: 17,
    SHIFT: 16,
    ALT: 18,
    SPACE: 32,
    空格: 32,
    ENTER: 13,
    回车: 13,
    TAB: 9,
    ESC: 27,
    BACKSPACE: 8,
    退格: 8,
    LEFT: 37,
    "←": 37,
    UP: 38,
    "↑": 38,
    RIGHT: 39,
    "→": 39,
    DOWN: 40,
    "↓": 40,
    DELETE: 46,
    HOME: 36,
    END: 35,
  };
  return text
    .toUpperCase()
    .split("+")
    .map((p) => {
      const k = p.trim();
      return (
        names[k] ??
        (/^F([1-9]|1\d|2[0-4])$/.test(k)
          ? 111 + Number(k.slice(1))
          : /^VK \d+$/.test(k)
            ? Number(k.slice(3))
            : /^[A-Z0-9]$/.test(k)
              ? k.charCodeAt(0)
              : 0)
      );
    });
}
class KeyField extends TextField {
  protected override onHtmlInputKeyDown_(event: KeyboardEvent) {
    if (event.key === "Tab") {
      super.onHtmlInputKeyDown_(event);
      return;
    }
    const key = virtualKey(event.code);
    if (!key) return;
    event.preventDefault();
    event.stopPropagation();
    const keys = [
      ...new Set([
        ...(event.ctrlKey ? [17] : []),
        ...(event.shiftKey ? [16] : []),
        ...(event.altKey ? [18] : []),
        key,
      ]),
    ];
    const text = formatKeys(keys);
    if (this.htmlInput_) this.htmlInput_.value = text;
    this.setValue(text);
  }
}

function shape(this: ActionBlock, state: ActionState) {
  // Keep statement connections while changing the settings or IF branches.
  const children = new Map(
    this.inputList
      .filter((i) => i.connection?.targetConnection && !i.connection.targetBlock()?.isShadow())
      .map((i) => [i.name, i.connection!.targetConnection!]),
  );
  const shadows=new Map(this.inputList.filter(i=>i.connection?.targetBlock()?.isShadow()).map(i=>[i.name,Blockly.serialization.blocks.save(i.connection!.targetBlock()!)!]));
  this.inputList.slice().forEach((i) => this.removeInput(i.name));
  this.payload = structuredClone(state);
  this.bindings = [];
  const step = state.step,
    a = step.action,
    type = isStopAction(step) ? "stop" : a.type;
  const env =
    services.get(this.workspace) ??
    services.get((this.workspace as Blockly.WorkspaceSvg).targetWorkspace!);
  this.setColour(
    colors[type] ??
      (["key", "keyDown", "keyUp", "text", "click", "drag", "scroll"].includes(type)
        ? "#39738d"
        : "#557c55"),
  );
  this.setPreviousStatement(true, "Action");
  this.setNextStatement(true, "Action");
  this.setInputsInline(true);
  const title = this.appendDummyInput("TITLE");
  if (type === "comment" && !this.workspace.isFlyout) {
    const grip = new Blockly.FieldLabel("⠿", "auto-blockly-comment-grip");
    grip.setTooltip("拖动注解");
    title.appendField(grip);
  } else if (configuredActions.has(type) && !this.workspace.isFlyout) {
    const summary = stepSummary(step, env?.names ?? {});
    title.appendField(summary.length > 70 ? summary.slice(0, 70) + "…" : summary);
  } else if (!["key", "keyDown", "keyUp"].includes(type))
    title.appendField(
      (
        {
          focus: "切换窗口",
          group: "新建分组",
          set: "设置",
          calculate: "设置",
          stop: "停止任务",
          key: "按键",
          keyDown: "按住按键",
          keyUp: "松开按键",
          runTask: "运行任务",
          waitUntil: "重复执行直到",
          holdUntil: "保持等待直到",
          text: "输入文字",
          notify: "提示",
          loop: "重复",
          break: "退出循环",
          goto: "跳到",
          assert: "如果",
          ocr: "读取文字",
          match: "查找图片",
          capture: "保存截图",
          comment: "注解",
        } as Record<string, string>
      )[type] ??
        (this.workspace.isFlyout
          ? ({ click: "鼠标操作" } as Record<string, string>)[type]
          : undefined) ??
        env?.names[type] ??
        type,
    );
  const text = (
    input: Blockly.Input,
    name: string,
    label: string,
    value: unknown,
    apply: Binding["apply"],
    field?: Blockly.Field,
  ) => {
    const original = String(value ?? "");
    if (label) input.appendField(label);
    input.appendField(field ?? new TextField(original), name);
    this.bindings.push({ name, original, apply });
  };
  const property = (
    key: string,
    label: string,
    number = false,
    input = title,
    target: (s: ActionState) => Step = (s) => s.step,
    prefix = "",
  ) => {
    const value = target(state).action[key];
    text(input, prefix + key, label, value, (s, v) => {
      target(s).action[key] = number ? (v.trim() === "" ? -1 : Number(v)) : v;
    });
  };
  const slot=(key:string,type:ValueType,prefix="")=>this.appendValueInput(prefix+"VALUE_"+key).setCheck(connectionType(type));
  const targetField = (key = "target", alias = false) => {
    const current = String(a[key] ?? "");
    const choices: [string, string][] = [
      [
        alias
          ? "选择窗口"
          : type === "focus" ? "选择窗口" : "选择软件窗口",
        "",
      ],
    ];
    let selectedValue = current;
    const choicesForOpen = (): [string, string][] => {
      const live = alias
        ? (env?.slots() ?? [])
        : key === "title"
          ? (env?.windows() ?? [])
          : (env?.windows() ?? []).map((v) => "window:" + v);
      return [
        choices[0],
        ...[
          ...new Set([...live, ...(selectedValue ? [selectedValue] : [])]),
        ].map(
          (v) => [key === "title" ? v : windowName(v), v] as [string, string],
        ),
      ];
    };
    const dropdown = alias
      ? new Blockly.FieldDropdown(choicesForOpen)
      : new WindowDropdown(
          choicesForOpen,
          () => env?.refresh() ?? Promise.resolve(),
        );
    dropdown.setValidator((value) => {
      selectedValue = value;
      return value;
    });
    dropdown.setValue(current);
    text(
      title,
      key,
      key === "title" ? "设置为" : type === "focus" ? "" : "目标窗口",
      current,
      (s, v) => {
        s.step.action[key] = v;
      },
      dropdown,
    );
  };
  if (type === "wait") {slot("seconds","number");this.appendDummyInput("UNIT").appendField("秒");}
  if (["waitUntil","holdUntil"].includes(type)) {
    slot("expression","boolean");
    this.appendEndRowInput("CONDITION_END");
    const timing=this.appendDummyInput("TIMING");
    for(const [key,label] of [["timeoutMs","最多"],["intervalMs","每"]]) {
      text(timing,key,label,Number(a[key])/1000,(s,v)=>{s.step.action[key]=v.trim()===""?-1:Math.round(Number(v)*1000);});
      timing.appendField(key==="timeoutMs"?"秒":"秒检查");
    }
  }
  if (type === "runTask") {
    let items = env?.tasks?.() ?? [];
    let selected = String(a.taskId ?? "");
    const choices = (): [string,string][] => [
      ["选择任务", ""],
      ...items.map(item=>[item.name,item.id] as [string,string]),
      ...(selected && !items.some(item=>item.id===selected) ? [["已选任务（不可用）",selected] as [string,string]] : []),
    ];
    const dropdown = new WindowDropdown(choices,async()=>{items=await env?.refreshTasks?.() ?? env?.tasks?.() ?? [];});
    dropdown.setValidator(value=>{selected=value;return value;});
    dropdown.setValue(selected);
    text(title,"taskId","",selected,(s,v)=>{s.step.action.taskId=v;},dropdown);
  }
  if (["group", "label"].includes(type)) property("name", "");
  if (["text", "notify"].includes(type)) slot("text","string");
  if (type === "comment" && !this.workspace.isFlyout)
    text(
      title,
      "text",
      "",
      a.text,
      (s, value) => {
        s.step.action.text = value;
      },
      new CommentField(String(a.text ?? ""), (value) =>
        env?.editComment(this, value),
      ),
    );
  if (type === "goto") property("label", "");
  if(type==="loop") {slot("count","number");this.appendDummyInput("UNIT").appendField("次（0=一直）");}
  if(["if","elseIf","assert"].includes(type)) slot("expression","boolean");
  if(type==="assert") this.appendDummyInput("STOP_LABEL").appendField(step.inputs?.values.expression && a.stopWhenTrue!==true ? "不成立则停止任务" : "则停止任务");
  if (["set", "calculate"].includes(type)) {
    property("variable", "");
    slot(type === "set" ? "value" : "expression", "any").appendField("为");
  }
  if (type === "regex") {
    property("variable", "匹配变量");
    property("pattern", "规则");
    property("result", "结果保存为");
  }
  if (["key", "keyDown", "keyUp"].includes(type)) {
    const mode = new Blockly.FieldDropdown([["点击", "key"], ["按住", "keyDown"], ["松开", "keyUp"]]);
    title.appendField("按键");
    mode.setValue(type);
    text(
      title,
      "keys",
      "",
      formatKeys(a.keys),
      (s, v) => {
        s.step.action.keys = parseKeys(v);
      },
      new KeyField(formatKeys(a.keys)),
    );
    title.appendField(mode, "keyMode");
    if (!this.workspace.isFlyout) {
      const duration = this.appendDummyInput("KEY_DURATION");
      text(duration, "holdMs", "持续", a.holdMs ?? 30, (s,v) => { if (this.getFieldValue("keyMode") === "key") s.step.action.holdMs = v.trim() === "" ? -1 : Number(v); });
      duration.appendField("毫秒");
      duration.setVisible(type === "key");
      mode.setValidator(value => { this.getInput("KEY_DURATION")?.setVisible(value === "key"); return value; });
    }
    this.bindings.push({name:"keyMode", original:type, apply:(s,value) => {
      s.step.action.type = value;
      if (value === "key") s.step.action.holdMs ??= 30;
      else { delete s.step.action.holdMs; delete s.step.action.target; }
    }});
  }
  if (["focus", "setWindow"].includes(type)) {
    targetField("target", type === "setWindow");
    if (type === "setWindow") targetField("title");
  }
  if (configuredActions.has(type))
    title.appendField(
      new Blockly.FieldImage(icons("⚙"), 26, 22, "设置动作", () =>
        env?.configure(this),
      ),
    );
  state.branches?.forEach((branch) => {
    if (branch.head) {
      this.appendDummyInput("BRANCH_" + branch.key).appendField(
        branch.head.action.type === "else" ? "否则" : "否则如果",
      );
      if (branch.head.action.type === "elseIf")
        slot("expression","boolean","BRANCH_"+branch.key+"_");
    }
    this.appendStatementInput("BODY_" + branch.key).setCheck("Action");
  });
  if (type === "if") {
    const row = this.appendDummyInput("BRANCH_TOOLS");
    row
      .appendField("添加分支")
      .appendField(
        new Blockly.FieldImage(icons("+"), 26, 22, "添加否则如果", () =>
          env?.branch(this, "elseIf"),
        ),
      )
      .appendField(
        new Blockly.FieldImage(icons("∨"), 26, 22, "添加否则", () =>
          env?.branch(this, "else"),
        ),
      )
      .appendField(
        new Blockly.FieldImage(
          icons("−"),
          26,
          22,
          "移除最后分支并保留内部动作",
          () => env?.branch(this, "remove"),
        ),
      );
  }
  for (const [name, connection] of children)
    this.getInput(name)?.connection?.connect(connection);
  const defaults=(step:Step,prefix="")=>{
    for(const {key} of actionSlots(step)) {
      if(key==="expression") continue;
      const name=prefix+"VALUE_"+key;
      this.getInput(name)?.connection?.setShadowState((shadows.get(name)??encodeValue(fallbackValue(step,key))) as Blockly.serialization.blocks.State);
    }
  };
  defaults(state.step);
  state.branches?.forEach(branch=>{if(branch.head) defaults(branch.head,"BRANCH_"+branch.key+"_");});
  this.setTooltip(() => stepSummary(this.readState().step, env?.names ?? {}));
}

export function registerBlocks() {
  Blockly.setLocale(
    Object.fromEntries(
      Object.entries(Chinese).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  );
  if (Blockly.Blocks[ACTION_BLOCK]) return;
  registerValueBlocks();
  Blockly.Blocks[START_BLOCK] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField("任务开始");
      this.appendStatementInput("BODY").setCheck("Action");
      this.setColour("#566d40");
      this.setDeletable(false);
      this.setMovable(true);
      this.contextMenu = false;
    },
  };
  Blockly.Blocks[ACTION_BLOCK] = {
    init(this: ActionBlock) {
      this.shape({ step: { delayMs: 0, action: { type: "wait", ms: 1000 } } });
      if (this instanceof Blockly.BlockSvg)
        this.setDragStrategy(new ActionDragStrategy(this));
      if (this instanceof Blockly.BlockSvg) {
        this.customContextMenu = options => {
          const service = services.get(this.workspace);
          if (!this.workspace.isFlyout && !this.workspace.isReadOnly() && service?.saveComponent)
            options.push({text:"保存成组件",enabled:true,callback:()=>service.saveComponent!(this)});
        };
      }
    },
    shape,
    readState(this: ActionBlock) {
      const state = structuredClone(this.payload);
      this.bindings.forEach((binding) => {
        const value = String(this.getFieldValue(binding.name) ?? "");
        if (value !== binding.original) binding.apply(state, value);
      });
      return state;
    },
    saveExtraState(this: ActionBlock) {
      return this.readState();
    },
    loadExtraState(this: ActionBlock, state: ActionState) {
      this.shape(state);
    },
  };
}
