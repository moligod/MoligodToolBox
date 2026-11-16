const keys: Record<string, number> = {
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  NumpadEnter: 13,
  ShiftLeft: 16,
  ShiftRight: 16,
  ControlLeft: 17,
  ControlRight: 17,
  AltLeft: 18,
  AltRight: 18,
  Pause: 19,
  CapsLock: 20,
  Escape: 27,
  Space: 32,
  PageUp: 33,
  PageDown: 34,
  End: 35,
  Home: 36,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  PrintScreen: 44,
  Insert: 45,
  Delete: 46,
  MetaLeft: 91,
  MetaRight: 91,
  NumpadMultiply: 106,
  NumpadAdd: 107,
  NumpadSubtract: 109,
  NumpadDecimal: 110,
  NumpadDivide: 111,
  NumLock: 144,
  ScrollLock: 145,
  Semicolon: 186,
  Equal: 187,
  Comma: 188,
  Minus: 189,
  Period: 190,
  Slash: 191,
  Backquote: 192,
  BracketLeft: 219,
  Backslash: 220,
  BracketRight: 221,
  Quote: 222,
  IntlBackslash: 226,
};
export function virtualKey(code: string): number | null {
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
  if (/^Digit[0-9]$/.test(code)) return code.charCodeAt(5);
  if (/^Numpad[0-9]$/.test(code)) return 96 + Number(code.slice(6));
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return 111 + Number(code.slice(1));
  return keys[code] ?? null;
}
export function keyLabel(key: number | null): string {
  if (key === null) return "点击录入按键";
  if ((key >= 65 && key <= 90) || (key >= 48 && key <= 57))
    return String.fromCharCode(key);
  if (key >= 112 && key <= 135) return "F" + (key - 111);
  if (key >= 96 && key <= 105) return "小键盘 " + (key - 96);
  const names: Record<number, string> = {
    1: "鼠标左键",
    2: "鼠标右键",
    4: "鼠标中键",
    5: "鼠标侧键 1",
    6: "鼠标侧键 2",
    8: "Backspace",
    9: "Tab",
    13: "Enter",
    16: "Shift",
    17: "Ctrl",
    18: "Alt",
    19: "Pause",
    20: "Caps Lock",
    27: "Esc",
    32: "空格",
    33: "Page Up",
    34: "Page Down",
    35: "End",
    36: "Home",
    37: "←",
    38: "↑",
    39: "→",
    40: "↓",
    44: "Print Screen",
    45: "Insert",
    46: "Delete",
    91: "Win",
    106: "小键盘 *",
    107: "小键盘 +",
    109: "小键盘 -",
    110: "小键盘 .",
    111: "小键盘 /",
    144: "Num Lock",
    145: "Scroll Lock",
    186: ";",
    187: "=",
    188: ",",
    189: "-",
    190: ".",
    191: "/",
    192: "反引号",
    219: "[",
    220: "反斜杠",
    221: "]",
    222: "单引号",
    226: "反斜杠",
  };
  return names[key] ?? "键码 " + key;
}
export function mouseKey(button: number): number | null {
  return [1, 4, 2, 5, 6][button] ?? null;
}
export function bindHotkeyCapture(
  dialog: HTMLElement,
  options: {
    suspend: (active: boolean) => Promise<void>;
    changed: () => void;
    error: (error: unknown) => void;
  },
) {
  const button = document.getElementById("aim-hotkey") as HTMLButtonElement;
  const clear = document.getElementById("clear-hotkey") as HTMLButtonElement;
  const abort = new AbortController();
  const events = { signal: abort.signal };
  let recording = false,
    armed = false,
    pending: number | null = null,
    epoch = 0;
  let suppressMouseActivation = false;
  const refresh = () => {
    button.textContent = keyLabel(button.value ? Number(button.value) : null);
    button.setAttribute("aria-pressed", "false");
  };
  async function finish(commit: boolean) {
    epoch++;
    armed = false;
    if (!recording) return;
    recording = false;
    if (commit && pending !== null) {
      button.value = String(pending);
      options.changed();
    }
    pending = null;
    refresh();
    try {
      await options.suspend(false);
    } catch (error) {
      options.error(error);
    }
  }
  button.addEventListener(
    "click",
    () => {
      if (recording) {
        void finish(false);
        return;
      }
      recording = true;
      const generation = ++epoch;
      button.textContent = "按下键盘或鼠标…";
      button.setAttribute("aria-pressed", "true");
      void options
        .suspend(true)
        .then(() => {
          if (recording && generation === epoch) armed = true;
        })
        .catch((error) => {
          options.error(error);
          void finish(false);
        });
    },
    events,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (!recording) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!armed || event.repeat || pending !== null) return;
      const key = virtualKey(event.code);
      if (key === null) {
        button.textContent = "未识别，请换一个键";
        return;
      }
      pending = key;
      button.textContent = "松开 " + keyLabel(key) + " 完成";
    },
    { ...events, capture: true },
  );
  document.addEventListener(
    "keyup",
    (event) => {
      if (!recording) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pending !== null && virtualKey(event.code) === pending)
        void finish(true);
    },
    { ...events, capture: true },
  );
  const excluded = (target: EventTarget | null) =>
    target instanceof Element &&
    (!dialog.contains(target) ||
      Boolean(
        target.closest("#clear-hotkey,[data-close],[data-window-action]"),
      ));
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!recording) {
        suppressMouseActivation = false;
        return;
      }
      if (excluded(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!armed || pending !== null) return;
      pending = mouseKey(event.button);
      suppressMouseActivation = true;
      button.setPointerCapture(event.pointerId);
      if (pending !== null)
        button.textContent = "松开 " + keyLabel(pending) + " 完成";
    },
    { ...events, capture: true },
  );
  document.addEventListener(
    "pointerup",
    (event) => {
      if (!recording || excluded(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (pending !== null && mouseKey(event.button) === pending)
        void finish(true);
    },
    { ...events, capture: true },
  );
  for (const type of ["click", "auxclick", "contextmenu"]) {
    document.addEventListener(
      type,
      (event) => {
        if (excluded(event.target)) return;
        if (recording || suppressMouseActivation) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (type !== "contextmenu") suppressMouseActivation = false;
        }
      },
      { ...events, capture: true },
    );
  }
  button.addEventListener(
    "lostpointercapture",
    () => {
      if (recording) void finish(false);
    },
    events,
  );
  document.addEventListener(
    "pointercancel",
    () => {
      if (recording) void finish(false);
    },
    events,
  );
  clear.addEventListener(
    "click",
    () => {
      void (async () => {
        await finish(false);
        button.value = "";
        refresh();
        options.changed();
      })();
    },
    events,
  );
  dialog.addEventListener(
    "cancel",
    (event) => {
      if (recording) {
        event.preventDefault();
        void finish(false);
      }
    },
    events,
  );
  dialog.addEventListener(
    "close",
    () => {
      void finish(false);
    },
    events,
  );
  dialog.addEventListener(
    "deactivate",
    () => {
      void finish(false);
    },
    events,
  );
  window.addEventListener(
    "blur",
    () => {
      void finish(false);
    },
    events,
  );
  return {
    refresh,
    dispose() {
      void finish(false);
      abort.abort();
    },
  };
}
