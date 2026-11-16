import { keyLabel, virtualKey } from "./hotkey-capture.ts";

export interface StopHotkey {
  schemaVersion: 1;
  modifiers: number;
  key: number;
}
export const defaultStopHotkey: StopHotkey = { schemaVersion: 1, modifiers: 3, key: 121 };
export function stopHotkeyLabel(value: StopHotkey) {
  return [value.modifiers & 2 ? "Ctrl" : "", value.modifiers & 1 ? "Alt" : "",
    value.modifiers & 4 ? "Shift" : "", keyLabel(value.key)].filter(Boolean).join(" + ");
}
export function readStopHotkey(event: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): StopHotkey | null {
  if (/^(Control|Alt|Shift|Meta)/.test(event.code)) return null;
  const key = virtualKey(event.code);
  const modifiers = (event.ctrlKey ? 2 : 0) | (event.altKey ? 1 : 0) | (event.shiftKey ? 4 : 0);
  const fn = key !== null && key >= 112 && key <= 135 && key !== 123;
  const letter = key !== null && ((key >= 48 && key <= 57) || (key >= 65 && key <= 90));
  if (event.metaKey || (!fn && !(letter && (modifiers & 3))))
    throw new Error("请使用功能键（F12 除外），或 Ctrl / Alt 加字母、数字；不支持 Win 组合键。");
  return { schemaVersion: 1, modifiers, key: key! };
}

export function initAutomationHotkeys(root: HTMLElement, options: {
  preview: boolean;
  save: (settings: StopHotkey) => Promise<StopHotkey>;
}) {
  const button = root.querySelector<HTMLButtonElement>("#auto-stop-key")!;
  const reset = root.querySelector<HTMLButtonElement>("#auto-stop-key-reset")!;
  const status = root.querySelector<HTMLElement>("#auto-stop-key-status")!;
  let current = defaultStopHotkey, ready = options.preview, disabled = false, saving = false, recording = false;
  function paint() {
    button.disabled = reset.disabled = !ready || disabled || saving;
    button.textContent = recording ? "请按快捷键…" : ready ? stopHotkeyLabel(current) : "快捷键未加载";
    button.setAttribute("aria-pressed", String(recording));
  }
  function cancel() { recording = false; paint(); }
  async function save(next: StopHotkey) {
    recording = false;
    saving = true;
    paint();
    try {
      current = options.preview ? next : await options.save(next);
      status.textContent = options.preview ? "浏览器预览：快捷键仅用于展示，桌面客户端可保存并生效。" : "已保存。紧急停止会停止所有正在运行的任务。";
    } catch (error) { status.textContent = String(error); }
    finally { saving = false; paint(); }
  }
  button.onclick = () => {
    recording = !recording;
    status.textContent = "按下快捷键，Esc 取消；有任务运行时不可修改。";
    paint();
  };
  button.addEventListener("keydown", event => {
    if (!recording) return;
    if (event.code === "Tab") { cancel(); return; }
    event.preventDefault();
    event.stopPropagation();
    if (event.code === "Escape") { cancel(); return; }
    if (event.repeat || event.isComposing) return;
    try { const next = readStopHotkey(event); if (next) void save(next); }
    catch (error) { status.textContent = String(error); }
  });
  button.addEventListener("blur", cancel);
  root.addEventListener("deactivate", cancel);
  root.addEventListener("close", cancel);
  reset.onclick = () => { void save(defaultStopHotkey); };
  paint();
  return {
    setDisabled(value: boolean) { disabled = value; if (value) recording = false; paint(); },
    async load(read: () => Promise<StopHotkey>) {
      ready = false;
      paint();
      try { current = await read(); ready = true; }
      catch (error) { status.textContent = String(error); }
      paint();
    },
  };
}
