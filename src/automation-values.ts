import type { Step } from "./automation-editor";

export type ValueType = "number" | "string" | "boolean" | "any";
export type ValueBlock =
  | { kind: "literal"; value: unknown }
  | { kind: "variable"; name: string; valueType: ValueType }
  | { kind: "selector"; mode: "number"; value: number }
  | { kind: "selector"; mode: "string" | "variable"; value: string }
  | { kind: "expression"; source: string; valueType: ValueType }
  | { kind: "binary"; op: string; left: ValueBlock; right: ValueBlock; strictEquality?: boolean }
  | { kind: "not"; value: ValueBlock }
  | { kind: "query"; action: Step["action"] };
export interface ValueInputs {
  schemaVersion: 1 | 2 | 3;
  values: Record<string, ValueBlock>;
}
export const VALUE_BLOCK = "moligod_value";
export const isStopAction = (step: Step) =>
  step.action.type === "assert" && step.action.stopWhenTrue === true &&
  step.action.expression === "true" && !step.inputs?.values.expression;
export const valueType = (value: ValueBlock): ValueType =>
  value.kind === "literal"
    ? typeof value.value === "number"
      ? "number"
      : typeof value.value === "boolean"
        ? "boolean"
        : typeof value.value === "string"
          ? "string"
          : "any"
    : value.kind === "selector"
      ? value.mode === "variable" ? "any" : value.mode
    : value.kind === "variable" || value.kind === "expression"
      ? value.valueType
      : value.kind === "query"
        ? value.action.type === "match"
          ? "boolean"
          : value.action.numericResult === true && value.action.numbersOnly === true
            ? "any"
          : "string"
        : value.kind === "not" || !["+", "-", "*", "/", "%"].includes(value.op)
          ? "boolean"
          : "number";

export function actionSlots(step: Step): { key: string; type: ValueType }[] {
  if (isStopAction(step)) return [];
  const type = step.action.type;
  if (type === "wait") return [{ key: "seconds", type: "number" }];
  if (type === "loop") return [{ key: "count", type: "number" }];
  if (type === "set") return [{ key: "value", type: "any" }];
  if (["notify", "text"].includes(type))
    return [{ key: "text", type: "string" }];
  if (["if", "elseIf", "assert", "waitUntil", "holdUntil"].includes(type))
    return [{ key: "expression", type: "boolean" }];
  if (type === "calculate") return [{ key: "expression", type: "any" }];
  return [];
}
export function fallbackValue(step: Step, key: string): ValueBlock {
  if (key === "expression")
    return {
      kind: "expression",
      source:
        step.action.type === "assert" && step.action.stopWhenTrue !== true
          ? `!(${step.action.expression})`
          : String(step.action.expression ?? ""),
      valueType: step.action.type === "calculate" ? "any" : "boolean",
    };
  return {
    kind: "literal",
    value:
      key === "seconds"
        ? (Number(step.action.ms) + (step.delayMs || 0)) / 1000
        : step.action[key],
  };
}
export function visitValues(
  value: ValueBlock,
  visit: (value: ValueBlock) => void,
) {
  visit(value);
  if (value.kind === "binary") {
    visitValues(value.left, visit);
    visitValues(value.right, visit);
  }
  if (value.kind === "not") visitValues(value.value, visit);
}

export function requiredInputVersion(value: ValueBlock): 1 | 2 | 3 {
  const pending: { value: ValueBlock; depth: number }[] = [{value,depth:0}];
  let count = 0, version: 1 | 2 | 3 = 1;
  while (pending.length) {
    const next = pending.pop()!;
    if (++count > 128 || next.depth > 16 || !next.value || typeof next.value !== "object")
      throw new Error("取值积木内容无效或嵌套过深，原数据已保留");
    if (next.value.kind === "selector") version = Math.max(version, 2) as 1 | 2 | 3;
    if (next.value.kind === "binary") {
      if (next.value.strictEquality !== undefined) {
        if (typeof next.value.strictEquality !== "boolean") throw new Error("取值积木内容无效，原数据已保留");
        version = 3;
      }
      pending.push({value:next.value.left,depth:next.depth+1},{value:next.value.right,depth:next.depth+1});
    }
    if (next.value.kind === "not") pending.push({value:next.value.value,depth:next.depth+1});
  }
  return version;
}
