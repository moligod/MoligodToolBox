import type { Step } from "./automation-editor";

const windowActions = new Set([
  "setWindow",
  "focus",
  "click",
  "drag",
  "scroll",
  "key",
  "text",
  "ocr",
  "match",
  "capture",
]);
const emptyRegion = () => ({ x: 0, y: 0, width: 0, height: 0 });
export function setOcrNumbersOnly(step: Step, enabled: boolean) {
  if (step.action.type !== "ocr") return;
  step.action.numbersOnly = enabled;
  if (enabled) step.action.numericResult = true;
  else delete step.action.numericResult;
}
export function confirmOcrNumericResult(step: Step) {
  if (step.action.type === "ocr" && step.action.numbersOnly === true)
    step.action.numericResult = true;
}
export function requiredScriptVersion(steps: Step[]): number {
  let version = 1;
  for (const step of steps) {
    if (step.action.type === "ocr" && step.action.numericResult === true) version = Math.max(version, 3);
    if (step.action.type === "match" && step.action.templatePoint !== undefined) version = 4;
    if (step.inputs) {
      version = Math.max(version, 2);
      const values = [...Object.values(step.inputs.values)];
      while (values.length) {
        const item = values.pop()!;
        if (item.kind === "query" && item.action.type === "ocr" && item.action.numericResult === true) version = Math.max(version, 3);
        if (item.kind === "query" && item.action.type === "match" && item.action.templatePoint !== undefined) version = 4;
        if (item.kind === "binary") values.push(item.left, item.right);
        if (item.kind === "not") values.push(item.value);
      }
    }
    if (step.action.type === "holdUntil") version = Math.max(version, 2);
    if (step.action.type === "group" && Array.isArray(step.action.steps)) version = Math.max(version, requiredScriptVersion(step.action.steps as Step[]));
  }
  return version;
}
export function actionDraft(type: string): Step {
  if (type === "stop") return {delayMs:0, action:{type:"assert", expression:"true", message:"", stopWhenTrue:true}};
  const defaults: Record<string, object> = {
    setWindow: { title: "" },
    wait: { ms: 1000 },
    click: { x: -1, y: -1, button: "left", holdMs: 30, jitter: 0 },
    drag: {
      fromX: -1,
      fromY: -1,
      toX: -1,
      toY: -1,
      durationMs: 500,
      button: "left",
    },
    scroll: { x: -1, y: -1, delta: -120 },
    key: { keys: [32], holdMs: 30 },
    keyDown: { keys: [87] },
    keyUp: { keys: [87] },
    runTask: { taskId: "" },
    waitUntil: { expression: "", timeoutMs: 10000, intervalMs: 500 },
    holdUntil: { expression: "", timeoutMs: 10000, intervalMs: 500 },
    text: { text: "" },
    ocr: {
      region: emptyRegion(),
      variable: "result",
      numbersOnly: false,
      reuse: true,
    },
    match: {
      region: emptyRegion(),
      template: "",
      threshold: 0.95,
      variable: "result",
      savePosition: true,
    },
    capture: { region: emptyRegion(), name: "capture" },
    group: { name: "分组名", steps: [] },
    comment: { text: "" },
    notify: { text: "" },
    set: { variable: "result", value: "" },
    calculate: { variable: "result", expression: "" },
    regex: { variable: "result", pattern: "", result: "result_matched" },
    if: { expression: "" },
    elseIf: { expression: "" },
    assert: { expression: "", message: "", stopWhenTrue: true },
    loop: { count: 3 },
    label: { name: "" },
    goto: { label: "" },
  };
  return {
    delayMs: 0,
    action: {
      type,
      ...(windowActions.has(type) && !["key", "text"].includes(type) ? { target: "" } : {}),
      ...defaults[type],
    },
  };
}

export function actionIssues(
  step: Step,
  bound: (slot: string) => boolean,
): string[] {
  const a = step.action,
    issues: string[] = [];
  if (a.type === "notify" && !step.inputs?.values.text && !String(a.text ?? "").trim()) issues.push("请填写提示内容");
  if (a.type === "ocr" && a.ocrModel !== undefined && !["small", "tiny"].includes(String(a.ocrModel)))
    issues.push("请选择有效的 OCR 模型");
  const range = (value: unknown, max: number, min = 0) =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max;
  if (
    !range(step.delayMs, 60000) ||
    (a.type === "wait" && !range(a.ms, 3600000))
  )
    issues.push("请填写有效等待时间");
  if (
    ["key", "keyDown", "keyUp"].includes(a.type) &&
    (!Array.isArray(a.keys) ||
      !a.keys.length ||
      !a.keys.every((key) => range(key, 255, 1)))
  )
    issues.push("请填写有效按键");
  if (a.type === "text" && !step.inputs?.values.text && !a.text) issues.push("请填写文字");
  if (a.type === "runTask" && !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(String(a.taskId ?? ""))) issues.push("请选择要运行的任务");
  if (["waitUntil","holdUntil"].includes(a.type) && (!range(a.timeoutMs, 3600000, 100) || !range(a.intervalMs, 60000, 100))) issues.push("等待时限和检查间隔至少为0.1秒");
  if (a.type === "click" && a.position !== undefined && !String(a.position).trim()) issues.push("请填写位置变量");
  for (const key of ["holdMs", "durationMs", "count", "delta", "threshold"]) {
    if (!(key in a)) continue;
    const n = a[key];
    if (
      typeof n !== "number" ||
      !Number.isFinite(n) ||
      (key === "threshold"
        ? n < 0 || n > 1
        : !range(
            n,
            key === "count" ? 1000000 : key === "delta" ? 1200 : 60000,
            key === "delta" ? -1200 : key === "durationMs" ? 1 : 0,
          ))
    ) {
      issues.push("请填写有效参数");
      break;
    }
  }
  if (
    windowActions.has(a.type) &&
    !(["key", "text"].includes(a.type) && !a.target) &&
    (!a.target || (a.type !== "setWindow" && !bound(String(a.target))))
  )
    issues.push("请选择窗口");
  if (a.type === "setWindow" && !String(a.title ?? "").trim())
    issues.push("请选择要绑定的软件窗口");
  const coordinate = (v: unknown) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0;
  const region = (v: unknown) => {
    const r = v as Record<string, unknown> | undefined;
    return (
      !!r &&
      coordinate(r.x) &&
      coordinate(r.y) &&
      coordinate(r.width) &&
      Number(r.width) > 0 &&
      coordinate(r.height) &&
      Number(r.height) > 0
    );
  };
  if (
    ["click", "scroll"].includes(a.type) &&
    !(a.type === "click" && a.position !== undefined) &&
    (!coordinate(a.x) || !coordinate(a.y))
  )
    issues.push("请选择位置");
  if (a.type === "drag" && ![a.fromX, a.fromY, a.toX, a.toY].every(coordinate))
    issues.push("请选择起点和终点");
  if (["ocr", "match", "capture"].includes(a.type) && !region(a.region))
    issues.push("请选择区域");
  if (a.type === "match" && !a.template) issues.push("请选择匹配模板");
  for (const key of [
    "variable",
    "expression",
    "pattern",
    "label",
    "name",
  ])
    if (key in a && !String(a[key] ?? "").trim() && !(key==="expression" && step.inputs?.values.expression))
      issues.push(
        "请填写" +
          {
            variable: "变量",
            expression: "表达式",
            pattern: "匹配规则",
            label: "标签",
            name: "名称",
          }[key],
      );
  return issues;
}

export function setWaitDuration(step: Step, ms: number) {
  step.action.ms = Math.min(ms, 3600000);
  step.delayMs = Math.max(0, ms - 3600000);
}

export function switchMouseAction(step: Step, type: string) {
  if (!["click", "drag", "scroll"].includes(type)) return;
  const old = step.action;
  if (!["click", "drag", "scroll"].includes(old.type) || old.type === type) return;
  const next = actionDraft(type).action;
  next.target = old.target;
  if (old.mode) next.mode = old.mode;
  const x = old.type === "drag" ? old.fromX : old.x;
  const y = old.type === "drag" ? old.fromY : old.y;
  next[type === "drag" ? "fromX" : "x"] = x;
  next[type === "drag" ? "fromY" : "y"] = y;
  if ("button" in next && old.button) next.button = old.button;
  step.action = next;
}

