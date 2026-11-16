import type { Step } from "./automation-editor";
export function windowName(slot: string): string {
  if (slot.startsWith("window:")) return slot.slice(7);
  return /^[A-Z]$/.test(slot)
    ? `窗口 ${slot.charCodeAt(0) - 64}`
    : "未选窗口";
}
export function formatKeys(value: unknown): string {
  if (!Array.isArray(value)) return "未设置";
  const names: Record<number, string> = {
    17: "Ctrl",
    16: "Shift",
    18: "Alt",
    32: "空格",
    13: "回车",
    9: "Tab",
    27: "Esc",
    8: "退格",
    37: "←",
    38: "↑",
    39: "→",
    40: "↓",
    46: "Delete",
    36: "Home",
    35: "End",
  };
  return value
    .map(
      (key) =>
        names[key] ??
        (key >= 112 && key <= 135
          ? `F${key - 111}`
          : key >= 48 && key <= 90
            ? String.fromCharCode(key)
            : `VK ${key}`),
    )
    .join(" + ");
}

export function stepSummary(step: Step, names: Record<string, string>): string {
  const a = step.action;
  const window = !a.target && ["key", "text"].includes(a.type) ? "当前前台窗口" : windowName(String(a.target ?? ""));
  const point = a.type === "click" && a.position !== undefined ? `的 ${a.position || "未填变量"} 位置` : `（${a.x}, ${a.y}）`;
  let text: string;
  switch (a.type) {
    case "wait":
      text = `等待 ${(Number(a.ms) + (step.delayMs || 0)) / 1000} 秒`;
      break;
    case "click":
      text = `在${window}${point}点击${({ left: "左键", right: "右键", middle: "中键" } as Record<string, string>)[String(a.button)] ?? a.button}`;
      break;
    case "text":
      text = `在${window}输入“${a.text}”`;
      break;
    case "key":
      text = `在${window}按 ${formatKeys(a.keys)}`;
      break;
    case "keyDown":
      text = `按住按键 ${formatKeys(a.keys)}，直到松开或任务结束`;
      break;
    case "keyUp":
      text = `松开按键 ${formatKeys(a.keys)}`;
      break;
    case "runTask":
      text = "执行所选已保存任务一次，结束后继续；共用变量";
      break;
    case "waitUntil":
      text = `重复内部动作，直到 ${a.expression}；最多 ${Number(a.timeoutMs)/1000} 秒，超时停止`;
      break;
    case "holdUntil":
      text = `等待条件成立后继续；最多 ${Number(a.timeoutMs)/1000} 秒，超时停止`;
      break;
    case "ocr":
      text = `读取 ${window} 的文字，保存到 ${a.variable}`;
      break;
    case "match":
      text = `在 ${window} 查找图片，${a.savePosition ? "位置" : "结果"}保存到 ${a.variable}`;
      break;
    case "capture":
      text = `截取 ${window}，保存为 ${a.name}`;
      break;
    case "set":
      text = `保存 ${typeof a.value === "string" ? a.value : JSON.stringify(a.value)} 到 ${a.variable}`;
      break;
    case "calculate":
      text = `计算 ${a.expression}，保存到 ${a.variable}`;
      break;
    case "loop":
      text =
        Number(a.count) === 0
          ? "一直重复"
          : `重复 ${a.count} 次`;
      break;
    case "if":
      text = `如果 ${a.expression}`;
      break;
    case "assert":
      text = `如果 ${a.stopWhenTrue === true ? a.expression : `!(${a.expression})`} 则停止任务`;
      break;
    case "notify":
      text = `提示：${a.text}`;
      break;
    case "group":
      text = `分组：${a.name}`;
      break;
    case "comment":
      text = `注解：${a.text}`;
      break;
    case "setWindow":
      text = `将${window}设置为 ${a.title || "未选择软件"}`;
      break;
    case "focus":
      text = `切换到 ${window}`;
      break;
    case "drag":
      text = `在${window}从（${a.fromX}, ${a.fromY}）拖到（${a.toX}, ${a.toY}）`;
      break;
    case "scroll":
      text = `在${window}${point}向${Number(a.delta) < 0 ? "下" : "上"}滚动 ${Math.abs(Number(a.delta)) / 120} 次`;
      break;
    default:
      text = names[a.type] ?? a.type;
  }
  return `${step.delayMs && a.type !== "wait" ? `先等 ${step.delayMs / 1000} 秒，再` : ""}${text}`;
}
