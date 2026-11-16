import { regexCondition, readRegexCondition } from "./automation-condition.ts";
import { virtualKey } from "./hotkey-capture.ts";
import { scaleAction } from "./automation-scale.ts";
import { setWaitDuration } from "./automation-action-draft.ts";
import { startDragScroll } from "./automation-drag-scroll.ts";
import type { Step } from "./automation-editor";
import {
  stepSummary,
  formatKeys,
  windowName,
} from "./automation-step-summary.ts";
import {
  blockList,
  bindingBefore,
  moveBlock,
  newBlock,
  parseBlocks,
  writeBlocks,
  type Block,
  type BlockPath,
} from "./automation-block-model.ts";
interface Options {
  names: Record<string, string>;
  running: () => boolean;
  change: (steps: Step[]) => void;
  update: (steps: Step[]) => void;
  notify: (text: string, error?: boolean) => void;
  slots: () => string[];
  addSlot?: () => string | undefined;
  windows?: () => string[];
  refreshWindows?: () => Promise<void>;
  compose?: (anchor: HTMLElement) => void;
  configure?: (step: Step, parent: HTMLElement, update: () => void) => void;
  beforeRender?: () => void;
  issues?: (step: Step) => string[];
}
const labels: Record<string, string> = {
  target: "窗口",
  ms: "等待（秒）",
  count: "次数（0 持续）",
  name: "名称",
  text: "内容",
  expression: "条件 / 表达式",
  variable: "变量",
  x: "X",
  y: "Y",
  width: "宽",
  height: "高",
  fromX: "起点 X",
  fromY: "起点 Y",
  toX: "终点 X",
  toY: "终点 Y",
  button: "鼠标",
  holdMs: "按住 ms",
  durationMs: "时长 ms",
  delta: "滚动量",
  numbersOnly: "仅数字",
  reuse: "复用结果",
  value: "值",
  threshold: "阈值",
  label: "跳转标签",
  pattern: "匹配模式",
  result: "结果变量",
  message: "提示",
  delayMs: "前延时 ms",
  randomDelayMs: "随机延时 ms",
};
export function createBlockEditor(root: HTMLElement, options: Options) {
  let nodes: Block[] = [],
    insertion: BlockPath = [],
    internal = false;
  let folded = new Set<string>();
  let line = 0;
  let insertionAt: number | undefined;
  let broken = false;
  const simple = true;
  let refreshRows: (() => void)[] = [];
  let insertedPath: string | undefined;
  const afterRender: (() => void)[] = [];
  let cancelDrag: (() => void) | undefined;
  function commit(next = nodes) {
    folded.clear();
    function remember(list: Block[], path: BlockPath = []) {
      list.forEach((node, index) => {
        const here = [...path, index];
        if (node.collapsed) folded.add(here.join("."));
        node.branches?.forEach((branch, branchIndex) =>
          remember(branch.blocks, [...here, branchIndex]),
        );
      });
    }
    remember(next);
    internal = true;
    try {
      options.change(writeBlocks(next));
    } finally {
      internal = false;
    }
  }
  function number(parent: HTMLElement) {
    const gutter = document.createElement("span");
    gutter.className = "block-number";
    gutter.textContent = String(++line).padStart(2, "0");
    parent.append(gutter);
  }
  function syntax(parent: HTMLElement, value: string) {
    const token = document.createElement("span");
    token.className = "block-syntax";
    token.textContent = value;
    parent.append(token);
  }
  function button(label: string, work: () => void, title = label) {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.title = title;
    element.setAttribute("aria-label", title);
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      if (options.running()) return;
      try {
        work();
      } catch (error) {
        options.notify(String(error), true);
      }
    });
    return element;
  }
  function field(
    key: string,
    value: unknown,
    update: (value: unknown) => void,
    live = false,
  ) {
    if (key === "ms" && typeof value === "number") {
      value /= 1000;
      const save = update;
      update = (seconds) => save(Math.round(Number(seconds) * 1000));
    }
    const label = document.createElement("label");
    label.className = "block-field";
    const text = document.createElement("span");
    text.textContent = labels[key] ?? key;
    label.append(text);
    let control: HTMLInputElement | HTMLSelectElement;
    const choices =
      key === "target"
        ? (options.windows?.() ?? []).map(title => ["window:" + title, title])
        : key === "button"
          ? [
              ["left", "左键"],
              ["right", "右键"],
              ["middle", "中键"],
            ]
          : key === "part"
            ? [
                ["A", "A"],
                ["B", "B"],
              ]
            : undefined;
    if (choices) {
      const select = document.createElement("select");
      select.replaceChildren(
        ...choices.map(([id, name]) => new Option(name, id)),
      );
      if (!choices.some(([id]) => id === value))
        select.add(new Option(String(value), String(value)));
      select.value = String(value);
      control = select;
    } else {
      const input = document.createElement("input");
      input.type =
        typeof value === "boolean"
          ? "checkbox"
          : typeof value === "number"
            ? "number"
            : "text";
      if (typeof value === "boolean") input.checked = value;
      else
        input.value =
          typeof value === "object"
            ? JSON.stringify(value)
            : String(value ?? "");
      if (typeof value === "number") {
        input.step =
          key === "ms" ? "0.001" : key === "threshold" ? "0.01" : "1";
        input.min =
          key === "delta"
            ? "-1200"
            : ["width", "height", "durationMs"].includes(key)
              ? "1"
              : "0";
        if (["holdMs", "durationMs", "delayMs", "randomDelayMs"].includes(key))
          input.max = "60000";
        if (key === "ms") input.max = "3660";
        if (key === "delta") input.max = "1200";
        if (key === "threshold") input.max = "1";
      }
      control = input;
    }
    control.setAttribute("aria-label", labels[key] ?? key);
    control.dataset.valueType = typeof value;
    function fit() {
      if (control instanceof HTMLInputElement && control.type === "text")
        control.style.width = `${Math.min(40, Math.max(8, control.value.replace(/[^\x00-\xff]/g, "xx").length + 2))}ch`;
    }
    fit();
    function updateField(report = false) {
      fit();
      if (options.running()) return;
      try {
        if (!live && (
          !control.checkValidity() ||
          (control instanceof HTMLInputElement &&
            control.type === "number" &&
            !control.value)
        ))
          throw new Error("动作参数无效");
        const next =
          typeof value === "boolean"
            ? (control as HTMLInputElement).checked
            : typeof value === "number"
              ? control.value === "" ? -1 : Number(control.value)
              : typeof value === "object"
                ? JSON.parse(control.value)
                : control.value;
        update(next);
        options.update(writeBlocks(nodes));
      } catch (error) {
        if (report) options.notify(String(error), true);
      }
    }
    control.addEventListener("input", () => updateField());
    control.addEventListener("change", () => updateField(true));
    label.append(control);
    return label;
  }
  const simpleTypes = ["if", "elseIf", "assert", "loop", "set", "calculate", "label", "goto"];
  function simpleFields(step: Step, parent: HTMLElement) {
    const a = step.action;
    const row = document.createElement("div");
    row.className = "block-inline-fields";
    const add = (key: string, label: string, value = a[key], save = (next: unknown) => { a[key] = next; }) => {
      const item = field(key, value, save, true);
      item.querySelector("span")!.textContent = label;
      item.querySelector("input,select")!.setAttribute("aria-label", label);
      row.append(item);
      return item;
    };
    if (["if", "elseIf"].includes(a.type)) {
      const parsed = readRegexCondition(String(a.expression ?? ""));
      let source = parsed?.source ?? "result_A", pattern = parsed?.pattern ?? "";
      const label = document.createElement("label");
      label.className = "block-field";
      label.append("判断方式 ");
      const kind = document.createElement("select");
      kind.setAttribute("aria-label", "判断方式");
      kind.append(new Option("表达式判断", "expression"), new Option("正则匹配", "regex"));
      kind.value = parsed ? "regex" : "expression";
      label.append(kind); row.append(label);
      const expression = add("expression", "表达式");
      const saveRegex = () => { a.expression = regexCondition(source.trim(), pattern); };
      const sourceField = add("source", "匹配变量", source, next => { source = String(next); saveRegex(); });
      const patternField = add("pattern", "正则规则", pattern, next => { pattern = String(next); saveRegex(); });
      const show = () => {
        expression.hidden = kind.value === "regex";
        sourceField.hidden = patternField.hidden = kind.value !== "regex";
      };
      kind.addEventListener("change", () => {
        if (options.running()) return;
        if (kind.value === "regex") saveRegex();
        else (expression.querySelector("input")!).value = String(a.expression ?? "");
        show(); options.update(writeBlocks(nodes)); refreshRows.forEach(refresh => refresh());
      });
      show();
    } else {
      if (["set", "calculate"].includes(a.type)) add("variable", "结果保存为");
      if (["assert", "calculate"].includes(a.type)) add("expression", "表达式");
      if (a.type === "loop") add("count", "循环次数（0 为持续循环）");
      if (a.type === "label") add("name", "标签名称");
      if (a.type === "goto") add("label", "跳到标签");
      if (a.type === "set") add("value", "要保存的值", typeof a.value === "string" ? a.value : JSON.stringify(a.value), next => {
        try { a.value = JSON.parse(String(next)); } catch { a.value = next; }
      });
    }
    parent.append(row);
  }
  function fields(step: Step, parent: HTMLElement) {
    const advanced = document.createElement("details"),
      caption = document.createElement("summary");
    advanced.className = "block-region";
    caption.textContent = "更多设置";
    advanced.append(caption);
    for (const [key, value] of Object.entries(step.action)) {
      if (["type", "steps", "template"].includes(key)) continue;
      if (key === "target" && ["key", "text"].includes(step.action.type)) continue;
      if (key === "region") {
        const area = document.createElement("details"),
          summary = document.createElement("summary");
        summary.textContent = "识别区域";
        area.className = "block-region";
        area.append(summary);
        for (const [axis, number] of Object.entries(
          value as Record<string, number>,
        ))
          area.append(
            field(axis, number, (next) => {
              (step.action[key] as Record<string, unknown>)[axis] = next;
            }),
          );
        parent.append(area);
      } else if (key === "keys") {
        const tag = document.createElement("span");
        tag.className = "block-key";
        tag.textContent = formatKeys(value);
        parent.append(tag);
      } else
        (["holdMs", "jitter", "reuse", "numbersOnly", "threshold"].includes(key)
          ? advanced
          : parent
        ).append(
          field(
            key,
            key === "ms" ? Number(value) + (step.delayMs || 0) : value,
            (next) => {
              if (key === "ms") setWaitDuration(step, Number(next));
              else step.action[key] = next;
            },
          ),
        );
    }
    if (advanced.childElementCount > 1) parent.append(advanced);
  }
  function stack(list: Block[], parent: HTMLElement, path: BlockPath = []) {
    const container = document.createElement("div");
    container.className = "block-stack";
    parent.append(container);
    function slot(at: number) {
      const zone = button(
        list.length ? "＋ 插入动作" : "＋ 在这里添加步骤",
        () => {
          insertion = path;
          insertionAt = at;
          root
            .querySelectorAll(".block-insertion")
            .forEach((el) => el.classList.remove("block-insertion"));
          zone.classList.add("block-insertion");
          options.compose?.(zone);
        },
        "选择此处作为添加位置",
      );
      zone.className = "block-slot";
      zone.dataset.blockSlot = `${path.join(".")}:${at}`;
      if (
        insertion.join(".") === path.join(".") &&
        at === (insertionAt ?? list.length)
      )
        zone.classList.add("block-insertion");
      container.append(zone);
    }
    list.forEach((node, index) => {
      slot(index);
      const here = [...path, index],
        type = node.step.action.type;
      const block = document.createElement("div");
      block.className = "automation-block";
      if (type === "group" || type === "comment") block.classList.add("block-" + type);
      block.dataset.blockPath = here.join(".");
      block.dataset.kind = node.branches ? "container" : "action";
      block.dataset.category = [
        "loop",
        "if",
        "else",
        "elseIf",
        "group",
        "endIf",
        "endLoop",
        "break",
        "continue",
        "goto",
        "label",
      ].includes(type)
        ? "control"
        : ["ocr", "match", "capture"].includes(type)
          ? "vision"
          : ["set", "calculate", "regex"].includes(type)
            ? "variable"
            : type === "comment"
              ? "comment"
              : "input";
      const header = document.createElement("div");
      header.className = "block-header";
      number(header);
      if (node.index !== undefined)
        header.dataset.executionIndex = String(node.index);
      const handle = button("⠿", () => {}, "拖动动作；方向键上下调整顺序");
      handle.className = "block-handle";
      let press: { x: number; y: number } | undefined;
      let point = { x: 0, y: 0 };
      let pointerId: number | undefined;
      let stopScroll: (() => void) | undefined;
      let destination: HTMLElement | undefined;
      function clearDrag() {
        press = undefined;
        stopScroll?.();
        stopScroll = undefined;
        if (pointerId !== undefined && header.hasPointerCapture(pointerId))
          header.releasePointerCapture(pointerId);
        pointerId = undefined;
        if (cancelDrag === clearDrag) cancelDrag = undefined;
        window.removeEventListener("blur", clearDrag);
        document.removeEventListener("visibilitychange", clearDrag);
        destination = undefined;
        root.classList.remove("block-dragging");
        root
          .querySelectorAll(".block-drop")
          .forEach((el) => el.classList.remove("block-drop"));
      }
      header.addEventListener("pointerdown", (event) => {
        const interactive = (event.target as HTMLElement).closest(
          "button,input,select,textarea,label,summary,#auto-action-setup",
        );
        if (
          options.running() ||
          event.button !== 0 ||
          (interactive && interactive !== handle)
        )
          return;
        event.preventDefault();
        cancelDrag?.();
        cancelDrag = clearDrag;
        handle.focus({ preventScroll: true });
        press = { x: event.clientX, y: event.clientY };
        point = press;
        pointerId = event.pointerId;
        header.setPointerCapture(event.pointerId);
        window.addEventListener("blur", clearDrag);
        document.addEventListener("visibilitychange", clearDrag);
      });
      function updateDestination() {
        const bounds = root.getBoundingClientRect();
        root
          .querySelectorAll(".block-drop")
          .forEach((el) => el.classList.remove("block-drop"));
        destination = [
          ...root.querySelectorAll<HTMLElement>(".block-slot"),
        ].find((zone) => {
          if (!zone.getClientRects().length) return false;
          const rect = zone.getBoundingClientRect();
          return (
            point.x >= rect.left &&
            point.x <= rect.right &&
            point.y >= rect.top - 6 &&
            point.y <= rect.bottom + 6 &&
            point.y >= bounds.top &&
            point.y <= bounds.bottom
          );
        });
        destination?.classList.add("block-drop");
      }
      header.addEventListener("pointermove", (event) => {
        if (!press || event.pointerId !== pointerId) return;
        point = { x: event.clientX, y: event.clientY };
        if (!stopScroll && Math.hypot(point.x - press.x, point.y - press.y) < 5)
          return;
        root.classList.add("block-dragging");
        stopScroll ??= startDragScroll(
          root,
          () => press && header.isConnected && !options.running() ? point : undefined,
          updateDestination,
        );
        updateDestination();
      });
      header.addEventListener("pointerup", () => {
        const drop = destination?.dataset.blockSlot;
        clearDrag();
        if (!drop || options.running()) return;
        try {
          const [raw, at] = drop.split(":");
          const next = moveBlock(
            nodes,
            here,
            raw ? raw.split(".").map(Number) : [],
            Number(at),
          );
          insertion = [];
          insertionAt = undefined;
          commit(next);
        } catch (error) {
          options.notify(String(error), true);
        }
      });
      header.addEventListener("pointercancel", clearDrag);
      header.addEventListener("lostpointercapture", clearDrag);
      function reorder(offset: number) {
        const next = index + offset;
        if (next < 0 || next >= list.length) return;
        commit(moveBlock(nodes, here, path, offset < 0 ? next : next + 1));
        root
          .querySelector<HTMLButtonElement>(
            `[data-block-path="${[...path, next].join(".")}"] .block-handle`,
          )
          ?.focus();
      }
      handle.addEventListener("keydown", (event) => {
        if (options.running()) return;
        if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          reorder(event.key === "ArrowUp" ? -1 : 1);
        }
      });
      header.append(handle);
      const content = document.createElement("div");
      content.className = "block-content";
      node.collapsed = folded.has(here.join("."));
      const fold = document.createElement("button");
      fold.type = "button";
      fold.className = "block-fold";
      const foldHint = document.createElement("span");
      foldHint.className = "block-fold-hint";
      foldHint.textContent = "…";
      function applyFold() {
        content.hidden = !!node.collapsed;
        foldHint.hidden = !node.collapsed;
        fold.textContent = node.collapsed ? "▸" : "▾";
        fold.setAttribute("aria-expanded", String(!node.collapsed));
        fold.setAttribute(
          "aria-label",
          `${node.collapsed ? "展开" : "折叠"}动作 ${options.names[type] ?? type}`,
        );
        if (
          node.collapsed &&
          insertion.length >= here.length &&
          here.every((n, i) => insertion[i] === n)
        ) {
          insertion = path;
          insertionAt = index + 1;
          root
            .querySelectorAll(".block-insertion")
            .forEach((el) => el.classList.remove("block-insertion"));
          root
            .querySelector(
              `[data-block-slot="${path.join(".")}:${insertionAt}"]`,
            )
            ?.classList.add("block-insertion");
        }
      }
      if (node.branches) {
        fold.addEventListener("click", (event) => {
          event.stopPropagation();
          node.collapsed = !node.collapsed;
          applyFold();
        });
        header.append(fold);
      }
      const title = document.createElement("strong");
      title.className = "block-title";
      title.textContent =
        type === "loop"
          ? "重复执行"
          : type === "if"
            ? "如果"
            : (options.names[type] ?? type);
      header.append(title);
      const description = document.createElement("strong");
      description.className = "block-description";
      const permanent = simple && simpleTypes.includes(type);
      header.classList.toggle("block-inline-action", permanent);
      const keyboard = type === "key" || type === "text";
      const inlineKey = type === "group" ? "name" : "text";
      const inlineInput = ["wait", "group", "comment"].includes(type)
        ? document.createElement("input")
        : undefined;
      const inlineValue = () =>
        type === "wait"
          ? String(
              (Number(node.step.action.ms) + (node.step.delayMs || 0)) / 1000,
            )
          : String(node.step.action[inlineKey] ?? "");
      if (inlineInput) {
        inlineInput.type = type === "wait" ? "number" : "text";
        if (type === "wait") {
          inlineInput.min = "0";
          inlineInput.max = "3660";
          inlineInput.step = "0.001";
        } else {
          inlineInput.maxLength = type === "group" ? 64 : 4096;
          inlineInput.placeholder = type === "group" ? "分组名称" : "备注内容";
        }
        inlineInput.className =
          type === "wait" ? "block-wait-input" : "block-text-input";
        inlineInput.setAttribute(
          "aria-label",
          type === "wait"
            ? "等待秒数"
            : type === "group"
              ? "分组名称"
              : "备注内容",
        );
        inlineInput.value = inlineValue();
        description.append(
          `${type === "wait" ? "等待" : type === "group" ? "分组：" : "备注："} `,
          inlineInput,
          type === "wait" ? " 秒" : "",
        );
        inlineInput.addEventListener("input", () => {
          if (options.running()) return;
          if (type === "wait")
            setWaitDuration(
              node.step,
              inlineInput.value === ""
                ? -1
                : Math.round(Number(inlineInput.value) * 1000),
            );
          else node.step.action[inlineKey] = inlineInput.value;
          options.update(writeBlocks(nodes));
          params.replaceChildren();
          fields(node.step, params);
        });
      }
      const windowSelects =
        type === "setWindow"
          ? [document.createElement("select"), document.createElement("select")]
          : type === "focus" || keyboard
            ? [document.createElement("select")]
            : undefined;
      function syncWindowSelects() {
        if (!windowSelects) return;
        const [alias, software] = windowSelects;
        if (!software) {
          const current = String(node.step.action.target ?? "");
          const targets = [...new Set(options.windows?.() ?? [])].map(title => "window:" + title);
          alias.replaceChildren(new Option(keyboard ? "当前前台窗口（不切换）" : "选择软件窗口", ""), ...targets.map(value => new Option(windowName(value), value)));
          if (current && !targets.includes(current)) alias.add(new Option(windowName(current) + "（原目标）", current));
          alias.add(new Option("↻ 刷新窗口列表", "__refresh"));
          alias.value = current;
          return;
        }
        alias.replaceChildren(
          new Option("选择窗口", ""),
          ...options.slots().map((slot) => new Option(windowName(slot), slot)),
        );
        if (options.slots().length < 26)
          alias.add(new Option("＋ 新建窗口", "__new"));
        alias.value = String(node.step.action.target ?? "");
        if (!software) return;
        const titles = [...new Set(options.windows?.() ?? [])];
        const current = String(node.step.action.title ?? "");
        software.replaceChildren(
          new Option("选择软件", ""),
          ...titles.map((title) => new Option(title, title)),
        );
        if (current && !titles.includes(current))
          software.add(new Option(current + "（当前未找到）", current));
        software.add(new Option("↻ 刷新窗口列表", "__refresh"));
        software.value = current;
      }
      if (windowSelects) {
        windowSelects.forEach((select, i) => {
          select.className = "block-window-select";
          if (keyboard) select.style.width = "105px";
          select.setAttribute("aria-label", i ? "软件窗口" : "目标窗口");
          select.addEventListener("change", async () => {
            if (options.running()) return;
            if (select.value === "__refresh") {
              try {
                await options.refreshWindows?.();
              } catch (error) {
                options.notify(String(error), true);
              }
              syncWindowSelects();
              return;
            }
            node.step.action[i ? "title" : "target"] =
              !i && select.value === "__new"
                ? (options.addSlot?.() ?? node.step.action.target)
                : select.value;
            if (keyboard && !select.value) delete node.step.action.target;
            options.update(writeBlocks(nodes));
            refreshRows.forEach((refresh) => refresh());
          });
        });
        if (!keyboard) description.append(
          type === "focus" ? "窗口切换：" : "将 ",
          windowSelects[0],
        );
        if (windowSelects[1]) description.append(" 设置为 ", windowSelects[1]);
      }
      if (keyboard) {
        description.prepend(type === "key" ? "键盘操作 " : "输入文本 ");
        const control = document.createElement("input");
        control.className = "block-text-input";
        control.setAttribute("aria-label", type === "key" ? "录入按键或组合键" : "输入文本");
        control.value = type === "key" ? formatKeys(node.step.action.keys) : String(node.step.action.text ?? "");
        control.placeholder = type === "key" ? "按下按键或组合键" : "输入文本";
        if (type === "key") {
          control.readOnly = true;
          control.addEventListener("keydown", event => {
            if (event.key === "Tab") return;
            event.preventDefault();
            event.stopPropagation();
            if (options.running()) return;
            const key = virtualKey(event.code);
            if (key === null) return;
            node.step.action.keys = [...new Set([...(event.ctrlKey ? [17] : []), ...(event.shiftKey ? [16] : []), ...(event.altKey ? [18] : []), ...(event.metaKey ? [91] : []), key])];
            control.value = formatKeys(node.step.action.keys);
            options.update(writeBlocks(nodes));
            describe();
          });
        } else {
          control.maxLength = 4096;
          control.addEventListener("input", () => {
            if (options.running()) return;
            node.step.action.text = control.value;
            options.update(writeBlocks(nodes));
          });
        }
        description.append(control);
        if (type === "key") description.append(field("holdMs", node.step.action.holdMs ?? 30, value => { node.step.action.holdMs = value; }));
        description.append(" 目标窗口 ", windowSelects![0]);
      }
      const describe = () => {
        description.title = stepSummary(node.step, options.names);
        if (windowSelects) syncWindowSelects();
        else if (!inlineInput) description.textContent = (permanent || header.classList.contains("block-compact")) ? (type === "if" ? "如果" : options.names[type] ?? type) : description.title;
        else if (document.activeElement !== inlineInput)
          inlineInput.value = inlineValue();
        const issues = options.issues?.(node.step) ?? [];
        header.classList.toggle("block-incomplete", issues.length > 0);
        header.setAttribute("aria-invalid", String(issues.length > 0));
      };
      refreshRows.push(describe);
      describe();
      header.append(description);
      if (permanent) simpleFields(node.step, header);
      header.addEventListener("input", (event) => {
        if (!windowSelects?.includes(event.target as HTMLSelectElement))
          describe();
      });
      syntax(header, "(");
      const params = document.createElement("div");
      params.className = "block-fields";
      fields(node.step, params);
      params.hidden = simple;
      const settings = document.createElement("div");
      settings.className = "block-fields block-setup";
      settings.hidden = true;
      const configure = () => {
        if (permanent) { header.querySelector<HTMLElement>(".block-inline-fields input, .block-inline-fields select")?.focus(); return; }
        if (["break", "continue"].includes(type)) return;
        if (windowSelects) {
          windowSelects[0].focus();
          return;
        }
        if (inlineInput && simple) {
          inlineInput.focus();
          return;
        }
        if (!options.configure) {
          params.hidden = false;
          params.dataset.expanded = "true";
          return;
        }
        params.hidden = true;
        settings.hidden = false;
        settings.dataset.expanded = "true";
        edit.setAttribute("aria-expanded", "true");
        options.configure?.(node.step, settings, () => {
          options.update(writeBlocks(nodes));
          params.replaceChildren();
          fields(node.step, params);
          describe();
        });
        describe();
      };
      const edit = button(
        "修改",
        () => {
          if (options.configure) {
            configure();
            return;
          }
          params.hidden = !params.hidden;
          params.dataset.expanded = String(!params.hidden);
          edit.setAttribute("aria-expanded", String(!params.hidden));
        },
        "修改这一步的设置",
      );
      edit.className = "block-edit";
      edit.hidden = permanent || !!inlineInput || !!windowSelects || ["break", "continue"].includes(type);
      edit.setAttribute("aria-expanded", "false");
      header.append(edit);
      header.append(params);
      if (options.configure) header.append(settings);
      syntax(header, node.branches ? ") {" : ");");
      if (node.branches) header.append(foldHint);
      const tools = document.createElement("span");
      tools.className = "block-tools";
      const annotation = document.createElement("input");
      const annotationRow = document.createElement("div");
      annotationRow.className = "block-annotation";
      annotation.placeholder = "写一行注解…";
      annotation.setAttribute("aria-label", "注解");
      annotation.maxLength = 4096;
      annotation.value = node.step.annotation ?? "";
      annotationRow.hidden = !annotation.value;
      annotation.addEventListener("input", () => {
        if (options.running()) return;
        if (annotation.value) node.step.annotation = annotation.value;
        else {
          delete node.step.annotation;
          annotationRow.hidden = true;
        }
        options.update(writeBlocks(nodes));
      });
      annotation.addEventListener("blur", () => {
        annotationRow.hidden = !annotation.value;
      });
      tools.append(button("✎", () => {
        annotationRow.hidden = false;
        annotation.focus();
      }, "添加或编辑注解"));
      annotationRow.append(annotation, button("×", () => {
        delete node.step.annotation;
        annotation.value = "";
        annotationRow.hidden = true;
        options.update(writeBlocks(nodes));
      }, "删除注解"));
      tools.append(
        button(
          "×",
          () => {
            list.splice(index, 1);
            insertion = [];
            insertionAt = undefined;
            commit();
          },
          "删除动作及内部步骤",
        ),
      );
      header.append(tools);
      block.append(header);
      block.append(annotationRow);
      block.append(content);
      node.branches?.forEach((branch, branchIndex) => {
        const branchParent = branch.head ? document.createElement("div") : content;
        if (branch.head) {
          branchParent.className = "block-content block-branch-content";
          content.append(branchParent);
          const branchStep = branch.head;
          const permanent = simple && branchStep.action.type === "elseIf";
          const bar = document.createElement("div");
          bar.className = "block-header block-branch";
          bar.classList.toggle("block-inline-action", permanent);
          number(bar);
          if (branch.index !== undefined) bar.dataset.executionIndex = String(branch.index);
          const description = document.createElement("strong");
          description.className = "block-description";
          const params = document.createElement("div");
          params.className = "block-fields";
          params.hidden = simple;
          fields(branchStep, params);
          const settings = document.createElement("div");
          settings.className = "block-fields block-setup";
          settings.hidden = true;
          function describeBranch() {
            description.textContent = branchStep.action.type === "else"
              ? "否则，执行以下步骤" : `否则如果 ${branchStep.action.expression}，执行以下步骤`;
            description.title = description.textContent;
            if (permanent || bar.classList.contains("block-compact")) description.textContent = "否则如果";
            const issues = options.issues?.(branchStep) ?? [];
            bar.classList.toggle("block-incomplete", issues.length > 0);
            bar.setAttribute("aria-invalid", String(issues.length > 0));
          }
          refreshRows.push(describeBranch);
          describeBranch();
          bar.append(description);
          if (permanent) simpleFields(branchStep, bar);
          bar.addEventListener("input", describeBranch);
          if (branchStep.action.type !== "else" && !permanent) {
            const editBranch = button("修改", () => {
              if (!options.configure) { params.hidden = !params.hidden; return; }
              params.hidden = true;
              settings.hidden = false;
              options.configure(branchStep, settings, () => {
                options.update(writeBlocks(nodes));
                params.replaceChildren();
                fields(branchStep, params);
                describeBranch();
              });
            }, "修改这一步的设置");
            editBranch.className = "block-edit";
            bar.append(editBranch);
          }
          const tools = document.createElement("span");
          tools.className = "block-tools";
          tools.append(button("×", () => {
            node.branches!.splice(branchIndex, 1);
            insertion = [];
            insertionAt = undefined;
            commit();
          }, "删除此分支及内部动作"));
          bar.append(params, settings, tools);
          branchParent.append(bar);
        }
        stack(branch.blocks, branchParent, [...here, branchIndex]);
      });
      if (node.branches) {
        const footer = document.createElement("div");
        footer.className = "block-footer";
        number(footer);
        syntax(footer, "}");
        if (node.tailIndex !== undefined)
          footer.dataset.executionIndex = String(node.tailIndex);
        if (node.tail && (node.tail.delayMs || node.tail.randomDelayMs))
          fields(node.tail, footer);
        if (type === "if") {
          footer.append(
            button("＋否则如果", () => {
              const branches = node.branches!;
              const at = branches.findIndex(
                (b) => b.head?.action.type === "else",
              );
              branches.splice(at < 0 ? branches.length : at, 0, {
                head: {
                  delayMs: 0,
                  action: { type: "elseIf", expression: "1 == 1" },
                },
                blocks: [],
              });
              commit();
            }),
          );
          if (!node.branches.some((b) => b.head?.action.type === "else"))
            footer.append(
              button("＋否则", () => {
                node.branches!.push({
                  head: { delayMs: 0, action: { type: "else" } },
                  blocks: [],
                });
                commit();
              }),
            );
        }
        content.append(footer);
        applyFold();
      }
      container.append(block);
      if (insertedPath === here.join(".")) {
        insertedPath = undefined;
        afterRender.push(configure);
      }
    });
    slot(list.length);
  }
  function render(steps: Step[]) {
    cancelDrag?.();
    options.beforeRender?.();
    refreshRows = [];
    afterRender.length = 0;
    root.classList.toggle("step-view", simple);
    if (!internal) {
      folded.clear();
      insertion = [];
      insertionAt = undefined;
    }
    let warning = "";
    broken = false;
    try {
      nodes = parseBlocks(steps);
    } catch (error) {
      broken = true;
      warning = String(error);
      nodes = steps.map((step, index) => ({
        step: structuredClone(step),
        index,
      }));
    }
    try {
      blockList(nodes, insertion);
    } catch {
      insertion = [];
    }
    const scroll = root.scrollTop;
    root.replaceChildren();
    line = 0;
    if (warning) {
      const note = document.createElement("p");
      note.className = "block-warning";
      note.textContent = warning;
      root.append(note);
    }
    const hat = document.createElement("div");
    hat.className = "block-hat";
    hat.textContent = "▶ 当脚本开始运行时 {";
    root.append(hat);
    stack(nodes, root);
    syntax(root, "}");
    root.scrollTop = scroll;
    afterRender.forEach((configure) => configure());
    setRunning(options.running());
  }
  function setRunning(running: boolean) {
    if (running) cancelDrag?.();
    root
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLButtonElement
      >("input,select,button")
      .forEach((el) => {
        el.disabled = running && !el.classList.contains("block-fold");
      });
  }
  function insert(step: Step) {
    if (options.running()) return;
    if (["else", "elseIf", "endIf", "endLoop"].includes(step.action.type)) {
      if (broken) {
        options.change([...writeBlocks(nodes), structuredClone(step)]);
        return;
      }
      if (["endIf", "endLoop"].includes(step.action.type))
        throw new Error("循环和条件已自动包含结束，无需单独添加");
      for (let i = insertion.length - 2; i >= 0; i -= 2) {
        const node = blockList(nodes, insertion.slice(0, i))[insertion[i]];
        if (node.step.action.type !== "if") continue;
        const branches = node.branches!;
        const otherwise = branches.findIndex(
          (branch) => branch.head?.action.type === "else",
        );
        if (step.action.type === "else" && otherwise >= 0)
          throw new Error("条件已有否则分支");
        const at = otherwise < 0 ? branches.length : otherwise;
        branches.splice(at, 0, { head: structuredClone(step), blocks: [] });
        insertion = [...insertion.slice(0, i + 1), at];
        insertionAt = undefined;
        commit();
        return;
      }
      throw new Error("请先点击条件内部的插入位置，再添加分支");
    }
    const target = blockList(nodes, insertion);
    insertedPath = [...insertion, insertionAt ?? target.length].join(".");
    target.splice(
      insertionAt === undefined
        ? target.length
        : Math.min(insertionAt, target.length),
      0,
      newBlock(step),
    );
    if (insertionAt !== undefined) insertionAt++;
    commit();
  }
  function highlight(status?: { running: boolean; step: number }) {
    if (status?.running) {
      const current = root.querySelector<HTMLElement>(
        `[data-execution-index="${status.step}"]`,
      );
      let parent = current?.parentElement;
      while (parent && parent !== root) {
        if (parent.classList.contains("block-content") && parent.hidden)
          parent.parentElement
            ?.querySelector<HTMLButtonElement>(".block-fold")
            ?.click();
        parent = parent.parentElement;
      }
    }
    root
      .querySelectorAll<HTMLElement>("[data-execution-index]")
      .forEach((el) =>
        el.classList.toggle(
          "auto-current-step",
          !!status?.running &&
            Number(el.dataset.executionIndex) === status.step,
        ),
      );
  }
  function foldAll(collapsed: boolean) {
    root
      .querySelectorAll<HTMLButtonElement>(".block-fold")
      .forEach((button) => {
        if ((button.getAttribute("aria-expanded") === "false") !== collapsed)
          button.click();
      });
  }
  function rescale(ratio: number) {
    const visit = (items: Block[]) => {
      for (const node of items) {
        scaleAction(node.step.action, ratio);
        for (const branch of node.branches ?? []) visit(branch.blocks);
      }
    };
    visit(nodes);
    options.update(writeBlocks(nodes));
    refreshRows.forEach(refresh => refresh());
  }
  return {
    render,
    rescale,
    windowBinding: (step: Step | undefined, slot: string) =>
      bindingBefore(nodes, step, slot),
    insert,
    setRunning,
    cancelDrag: () => cancelDrag?.(),
    highlight,
    foldAll,
    refreshValidation: () => refreshRows.forEach((refresh) => refresh()),
  };
}
