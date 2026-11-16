import * as Blockly from "blockly/core";
import { TextField } from "./automation-blockly-fields.ts";
import {
  VALUE_BLOCK,
  valueType,
  type ValueBlock,
  type ValueType,
} from "./automation-values.ts";
import { readRegexCondition, regexCondition } from "./automation-condition.ts";
import { stepSummary } from "./automation-step-summary.ts";
import { ValueDragStrategy } from "./automation-blockly-snap.ts";

export type ReporterBlock = Blockly.BlockSvg & {
  payload: ValueBlock;
  shape: (value: ValueBlock) => void;
  readValue: () => ValueBlock;
};
export const valueServices = new WeakMap<
  Blockly.Workspace,
  { configure: (block: ReporterBlock) => void }
>();
export const connectionType = (type: ValueType) =>
  type === "any"
    ? null
    : ({ number: "Number", string: "String", boolean: "Boolean" } as const)[
        type
      ];
export function registerValueBlocks() {
  Blockly.Blocks[VALUE_BLOCK] = {
    init(this: ReporterBlock) {
      this.shape({ kind: "literal", value: 0 });
      if(this instanceof Blockly.BlockSvg) this.setDragStrategy(new ValueDragStrategy(this));
    },
    shape(this: ReporterBlock, value: ValueBlock) {
      const children = new Map(
        this.inputList
          .filter(
            (i) =>
              i.connection?.targetConnection &&
              !i.connection.targetBlock()?.isShadow(),
          )
          .map((i) => [i.name, i.connection!.targetConnection!]),
      );
      const shadows = new Map(
        this.inputList
          .filter((i) => i.connection?.targetBlock()?.isShadow())
          .map((i) => [
            i.name,
            Blockly.serialization.blocks.save(i.connection!.targetBlock()!)!,
          ]),
      );
      this.inputList.slice().forEach((i) => this.removeInput(i.name));
      this.payload = structuredClone(value);
      const type = valueType(value);
      this.setOutput(true, connectionType(type));
      this.setColour(
        type === "boolean"
          ? "#8d6b32"
          : type === "number"
            ? "#426b92"
            : "#6e629e",
      );
      this.setInputsInline(true);
      const row = this.appendDummyInput("TITLE");
      const literalSelector = value.kind === "literal" && !this.isShadow() &&
        (typeof value.value === "boolean" || value.value === null);
      if (value.kind === "selector" || literalSelector) {
        const selectedMode = value.kind === "selector" ? value.mode
          : value.kind === "literal" && value.value === null ? "null" : "boolean";
        const mode = new Blockly.FieldDropdown([
          ["数字", "number"], ["文字", "string"], ["变量", "variable"],
          ["真/假", "boolean"], ["空值", "null"],
        ]);
        row.appendField(mode, "MODE")
          .appendField(new Blockly.FieldNumber(value.kind === "selector" && value.mode === "number" ? value.value : 1), "NUMBER")
          .appendField(new TextField(value.kind === "selector" && value.mode === "string" ? value.value : ""), "STRING")
          .appendField(new TextField(value.kind === "selector" && value.mode === "variable" ? value.value : "result"), "VARIABLE")
          .appendField(new Blockly.FieldDropdown([["真", "true"], ["假", "false"]]), "BOOLEAN");
        this.setFieldValue(value.kind === "literal" && value.value === false ? "false" : "true", "BOOLEAN");
        const visibility = (selected: string) => {
          this.getField("NUMBER")?.setVisible(selected === "number");
          this.getField("STRING")?.setVisible(selected === "string");
          this.getField("VARIABLE")?.setVisible(selected === "variable");
          this.getField("BOOLEAN")?.setVisible(selected === "boolean");
        };
        mode.setValue(selectedMode); visibility(selectedMode);
        mode.setValidator(selected => { visibility(selected); return selected; });
      }
      if (value.kind === "literal" && !literalSelector) {
        const v = value.value;
        row.appendField(
          typeof v === "number"
            ? new Blockly.FieldNumber(v)
            : typeof v === "boolean"
              ? new Blockly.FieldDropdown([
                  ["真", "true"],
                  ["假", "false"],
                ])
              : v === null
                ? new Blockly.FieldLabel("空值")
                : new TextField(String(v ?? "")),
          "VALUE",
        );
        if(typeof v==="boolean") this.setFieldValue(String(v),"VALUE");
      }
      if (value.kind === "variable") {
        row
          .appendField("变量")
          .appendField(new TextField(value.name), "NAME")
          .appendField(
            new Blockly.FieldDropdown([
              ["数字", "number"],
              ["文字", "string"],
              ["条件", "boolean"],
              ["任意值", "any"],
            ]),
            "TYPE",
          );
        this.setFieldValue(value.valueType, "TYPE");
      }
      if (value.kind === "expression") {
        const parsed = readRegexCondition(value.source);
        if (value.valueType === "boolean") {
          const mode = new Blockly.FieldDropdown([
            ["条件表达式", "expr"],
            ["正则匹配", "regex"],
          ]);
          row.appendField(mode, "KIND")
            .appendField(new TextField(value.source), "SOURCE")
            .appendField(new TextField(parsed?.source ?? "result"), "REGEX_SOURCE")
            .appendField(new TextField(parsed?.pattern ?? ""), "PATTERN");
          const visibility = (kind: string) => {
            this.getField("SOURCE")?.setVisible(kind !== "regex");
            this.getField("REGEX_SOURCE")?.setVisible(kind === "regex");
            this.getField("PATTERN")?.setVisible(kind === "regex");
          };
          mode.setValue(parsed ? "regex" : "expr");
          visibility(mode.getValue() ?? "expr");
          mode.setValidator((selected) => {
            visibility(selected);
            return selected;
          });
        } else {
          row.appendField("计算表达式")
            .appendField(new TextField(value.source), "SOURCE");
        }
      }
      if (value.kind === "binary") {
        const logic = ["&&", "||"].includes(value.op),
          math = ["+", "-", "*", "/", "%"].includes(value.op);
        const ops: [string, string][] = logic
          ? [
              ["且", "&&"],
              ["或", "||"],
            ]
          : math
            ? [
                ["+", "+"],
                ["−", "-"],
                ["×", "*"],
                ["÷", "/"],
                ["取余", "%"],
              ]
            : [
                ["=", "=="],
                ["≠", "!="],
                [">", ">"],
                ["<", "<"],
                ["≥", ">="],
                ["≤", "<="],
              ];
        this.removeInput("TITLE");
        const check = logic
          ? "Boolean"
          : math
            ? "Number"
            : null;
        const left = this.appendValueInput("LEFT").setCheck(check);
        if (logic) left.appendField(new Blockly.FieldLabel("放入条件"), "LEFT_HINT");
        this.appendValueInput("RIGHT")
          .setCheck(check)
          .appendField(new Blockly.FieldDropdown(ops), "OP");
        if (logic) this.getInput("RIGHT")!.appendField(new Blockly.FieldLabel("放入条件"), "RIGHT_HINT");
        this.setFieldValue(value.op, "OP");
      }
      if (value.kind === "not") {
        row.appendField("不满足");
        this.appendValueInput("VALUE").setCheck("Boolean");
      }
      if (value.kind === "query") {
        row.appendField(
          value.action.type === "match" ? "找到图片" : "读取文字",
        );
        const gear =
          "data:image/svg+xml," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="24"><text x="3" y="18" fill="white" font-size="18">⚙</text></svg>',
          );
        row.appendField(
          new Blockly.FieldImage(gear, 26, 24, "设置实时查询", () =>
            valueServices.get(this.workspace)?.configure(this),
          ),
        );
        this.setTooltip(() =>
          stepSummary(
            {
              delayMs: 0,
              action:
                this.payload.kind === "query"
                  ? this.payload.action
                  : value.action,
            },
            {},
          ),
        );
      } else this.setTooltip("拖入相同类型的取值插槽；条件可继续嵌套。");
      for (const [name, connection] of children)
        this.getInput(name)?.connection?.connect(connection);
      for (const [name, state] of shadows)
        this.getInput(name)?.connection?.setShadowState(state);
      const conditionHints = () => {
        let changed = false;
        for (const input of ["LEFT", "RIGHT"]) {
          const field = this.getField(input + "_HINT");
          const visible = !this.getInputTargetBlock(input);
          if (field && field.isVisible() !== visible) {
            field.setVisible(visible);
            changed = true;
          }
        }
        if (changed && this instanceof Blockly.BlockSvg && this.rendered)
          this.render();
      };
      conditionHints();
      if (!this.isShadow())
        this.setOnChange((event) => {
          conditionHints();
          if (
            event.type !== Blockly.Events.BLOCK_CHANGE ||
            (event as Blockly.Events.BlockChange).blockId !== this.id
          )
            return;
          if (this.payload.kind === "variable")
            this.setOutput(
              true,
              connectionType(this.getFieldValue("TYPE") as ValueType),
            );
          if (this.getField("MODE")) {
            const selectedType = valueType(this.readValue());
            this.setOutput(true, connectionType(selectedType));
            this.setColour(selectedType === "number" ? "#426b92"
              : selectedType === "boolean" ? "#8d6b32" : "#6e629e");
          }
          if (this.payload.kind === "binary") {
            const op = String(this.getFieldValue("OP"));
            const check = ["&&", "||"].includes(op)
              ? "Boolean"
              : ["+", "-", "*", "/", "%"].includes(op)
                ? "Number"
                : null;
            this.getInput("LEFT")?.setCheck(check);
            this.getInput("RIGHT")?.setCheck(check);
          }
        });
    },
    readValue(this: ReporterBlock): ValueBlock {
      const value = structuredClone(this.payload);
      if (this.getField("MODE")) {
        const mode = this.getFieldValue("MODE");
        if (mode === "number") return {kind:"selector",mode,value:Number(this.getFieldValue("NUMBER"))};
        if (mode === "string") return {kind:"selector",mode,value:String(this.getFieldValue("STRING"))};
        if (mode === "boolean") return {kind:"literal",value:this.getFieldValue("BOOLEAN") === "true"};
        if (mode === "null") return {kind:"literal",value:null};
        return {kind:"selector",mode:"variable",value:String(this.getFieldValue("VARIABLE"))};
      }
      if (value.kind === "literal")
        value.value =
          typeof value.value === "number"
            ? Number(this.getFieldValue("VALUE"))
            : typeof value.value === "boolean"
              ? this.getFieldValue("VALUE") === "true"
              : value.value === null
                ? null
                : String(this.getFieldValue("VALUE"));
      if (value.kind === "variable") {
        value.name = String(this.getFieldValue("NAME"));
        value.valueType = this.getFieldValue("TYPE") as ValueType;
      }
      if (value.kind === "expression")
        value.source =
          this.getFieldValue("KIND") === "regex"
            ? regexCondition(
                String(this.getFieldValue("REGEX_SOURCE")),
                String(this.getFieldValue("PATTERN")),
              )
            : String(this.getFieldValue("SOURCE"));
      if (value.kind === "binary") value.op = String(this.getFieldValue("OP"));
      return value;
    },
    saveExtraState(this: ReporterBlock) {
      return { value: this.readValue() };
    },
    loadExtraState(this: ReporterBlock, state: { value: ValueBlock }) {
      this.shape(state.value);
    },
  };
}
