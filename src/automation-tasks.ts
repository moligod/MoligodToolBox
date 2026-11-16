import type { Script } from "./automation-editor";
import { taskDrag } from "./automation-task-drag.ts";
import {
  automationAction,
  desktop,
  onAutomationTaskState,
  type BoundWindow,
  type AutomationStatus,
} from "./api";
type TaskScript = Script;
interface SavedTask {
  schemaVersion: 2;
  id: string;
  name: string;
  intervalMs: number;
  loop?: boolean;
  repeatCount?: number | null;
  script: TaskScript;
}
interface TaskRow {
  id: string;
  name: string;
  intervalMs: number;
  loop?: boolean;
  repeatCount?: number | null;
  error?: string;
}
export function moveTaskRows<T extends {id: string}>(rows: T[], from: string, to: string, after: boolean): T[] {
  if (from === to || !rows.some(row => row.id === from) || !rows.some(row => row.id === to)) return rows;
  const moved = rows.find(row => row.id === from)!;
  const next = rows.filter(row => row.id !== from);
  next.splice(next.findIndex(row => row.id === to) + Number(after), 0, moved);
  return next;
}
interface Options {
  read: () => TaskScript;
  exportScript: (script: TaskScript) => void;
  render: (script: TaskScript) => void;
  prepare?: (script: TaskScript) => Promise<void>;
  bindings: () => Record<string, BoundWindow>;
  notify: (text: string, error?: boolean) => void;
  visible: () => boolean;
  selection?: (active: boolean, hasTasks: boolean) => void;
  running?: (running: boolean) => void;
  highlight: (status: AutomationStatus | undefined) => void;
}
export interface TaskBackend {
  available: boolean;
  action: typeof automationAction;
  subscribe?: typeof onAutomationTaskState;
}
export function initAutomationTasks(
  options: Options,
  backend: TaskBackend = {
    available: desktop,
    action: automationAction,
    subscribe: onAutomationTaskState,
  },
) {
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const input = (id: string) => get<HTMLInputElement>(id);
  const currentTask = get("auto-current-task");
  let loopEnabled = false;
  let rows: TaskRow[] = [];
  let statuses: Record<string, AutomationStatus> = {};
  let selectedId: string | null = null;
  let draftIndex = 0;
  let dragging: string | undefined, orderSaving = false, refreshVersion = 0;
  const usedNames = new Set<string>();
  let selectionVersion = 0;
  const drafts = new Map<
    string,
    { script: TaskScript; name: string; interval: string; loop: boolean; repeatCount: string }
  >();
  // Metadata edits for other rows do not need to load or replace their scripts.
  const rowEdits = new Map<string, {name: string; interval: string; repeatCount: string}>();
  let disposed = false,
    stopListener: (() => void) | undefined;
  function sizeList() {
    const list = get("auto-task-list");
    const first = [...list.children].slice(0, 3) as HTMLElement[];
    if (first.length < 3) {
      list.style.maxHeight = "none";
      return;
    }
    const height = first.reduce((sum, row) => sum + row.offsetHeight, 0);
    if (height) list.style.maxHeight = `${height + 16}px`;
  }
  window.addEventListener("resize", sizeList);
  function saveDraft() {
    if (selectedId === null) return;
    // Refuse switching invalid scripts rather than silently discarding an unfinished draft.
    drafts.set(selectedId, {
      script: options.read(),
      name: input("auto-task-name").value,
      interval: input("auto-task-interval").value,
      loop: loopEnabled,
      repeatCount: input("auto-task-repeats").value,
    });
  }
  function syncLoop() {
    input("auto-task-interval").disabled = !loopEnabled;
  }
  input("auto-task-repeats").addEventListener("input", () => {
    loopEnabled = input("auto-task-repeats").value !== "1";
    syncLoop();
  });
  function paint() {
    options.running?.(Object.values(statuses).some(status => status.running));
    if (dragging !== undefined) return;
    syncLoop();
    const loopInput = get("auto-task-loop");
    const selectedName = input("auto-task-name").value;
    const list = get("auto-task-list");
    const scrollTop = list.scrollTop;
    const focused = list.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset
      : undefined;
    const active = document.activeElement as HTMLInputElement;
    const editing =
      active === input("auto-task-name") ||
      active === input("auto-task-interval") || active === input("auto-task-repeats");
    const caret = active?.type === "text" && (editing || focused?.taskAction === "name") ? active.selectionStart : null;
    get("auto-task-fields-home").append(get("auto-task-fields"));
    get("auto-task-fields").append(get("auto-task-loop"));
    currentTask?.replaceChildren();
    const createCard = get("auto-task-create");
    // Selection callbacks update import controls through document lookups.
    // Keep the card attached while rebuilding rows, then move it to the end.
    list.replaceChildren(createCard);
    const displayRows = visibleRows();
    options.selection?.(selectedId !== null, displayRows.length > 0);
    for (const row of displayRows) {
      const item = document.createElement("div");
      item.className = "auto-task-row";
      item.classList.toggle("selected", row.id === selectedId);
      item.dataset.taskId = row.id;
      {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "auto-task-drag";
        handle.textContent = "⠿";
        handle.dataset.taskId = row.id;
        handle.dataset.taskAction = "reorder";
        handle.setAttribute("aria-label", `拖动排序任务 ${row.name}；方向键上下移动`);
        handle.disabled = orderSaving;
        handle.addEventListener("keydown", event => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const down = event.key === "ArrowDown";
          const shown = visibleRows();
          const target = shown[shown.findIndex(value => value.id === row.id) + (down ? 1 : -1)];
          if (target) void reorder(row.id, target.id, down);
        });
        item.append(handle);
        taskDrag(handle,item,list,() => {
          if (orderSaving || dragging !== undefined) return false;
          dragging = row.id;
          return true;
        },target => {
          dragging = undefined;
          if (target) void reorder(row.id,target.id,target.after);
          else paint();
        });
      }
      const st = statuses[row.id];
      item.addEventListener("click", event => {
        if (row.id !== selectedId && !(event.target as HTMLElement).closest("button, details")) void selectTask(row.id);
      });
      if (row.id === selectedId) {
        for (const [id, action] of [["auto-task-name","name"],["auto-task-interval","interval"],["auto-task-repeats","repeats"]]) {
          input(id).dataset.taskId = row.id;
          input(id).dataset.taskAction = action;
        }
        (currentTask ?? item).append(get("auto-task-fields"));
      } else if (!currentTask) {
        const draft = drafts.get(row.id);
        const edited = rowEdits.get(row.id);
        const fields = document.createElement("div");
        fields.className = "auto-task-controls";
        const name = document.createElement("input");
        name.type = "text"; name.maxLength = 100; name.className = "auto-task-name-input";
        name.value = edited?.name ?? draft?.name ?? row.name;
        name.dataset.taskId = row.id; name.dataset.taskAction = "name";
        name.setAttribute("aria-label", `任务名称 ${row.name}`);
        const interval = document.createElement("input");
        interval.type = "number"; interval.min = "100"; interval.max = "3600000"; interval.className = "auto-task-interval-input";
        interval.value = edited?.interval ?? draft?.interval ?? String(row.intervalMs);
        interval.dataset.taskId = row.id; interval.dataset.taskAction = "interval";
        interval.setAttribute("aria-label", `执行间隔（毫秒） ${row.name}`);
        const label = document.createElement("span"); label.textContent = "间隔";
        const unit = document.createElement("span"); unit.textContent = "毫秒";
        fields.append(name,label,interval,unit);
        const repeatLabel = document.createElement("label");
        repeatLabel.className = "auto-loop-count"; repeatLabel.title = "0表示一直循环";
        const repeats = document.createElement("input");
        repeats.type = "number"; repeats.min = "0"; repeats.max = "100000";
        repeats.value = edited?.repeatCount ?? draft?.repeatCount ?? String(row.repeatCount ?? (row.loop ? 0 : 1));
        repeats.dataset.taskId = row.id; repeats.dataset.taskAction = "repeats";
        repeats.setAttribute("aria-label", `循环次数（0为一直循环） ${row.name}`);
        interval.disabled = repeats.value === "1" || !!row.error;
        name.disabled = repeats.disabled = !!row.error;
        const update = () => {
          rowEdits.set(row.id, {name:name.value, interval:interval.value, repeatCount:repeats.value});
          interval.disabled = repeats.value === "1";
        };
        for (const field of [name,interval,repeats]) field.addEventListener("input",update);
        repeatLabel.append("循环 ",repeats," 次");
        if (row.error) { name.title = row.error; }
        item.append(fields);
        var otherRepeat = repeatLabel;
      }
      if (currentTask) {
        const draft = drafts.get(row.id);
        const selected = row.id === selectedId;
        const name = selected ? selectedName : draft?.name ?? row.name;
        const repeats = selected ? input("auto-task-repeats").value : draft?.repeatCount ?? String(row.repeatCount ?? (row.loop ? 0 : 1));
        const interval = selected ? input("auto-task-interval").value : draft?.interval ?? String(row.intervalMs);
        const select = document.createElement("button");
        select.type = "button";
        select.className = "auto-task-select";
        select.dataset.taskId = row.id;
        select.dataset.taskAction = "select";
        select.setAttribute("aria-label", `打开任务 ${name}`);
        const title = document.createElement("span");
        title.className = "auto-task-title";
        title.textContent = name;
        const meta = document.createElement("span");
        meta.className = "auto-task-meta";
        meta.textContent = row.error ?? `${repeats === "0" ? "一直循环" : `执行 ${repeats} 次`}${repeats !== "1" ? ` · 间隔 ${interval} 毫秒` : ""}`;
        select.append(title, meta);
        select.addEventListener("click", () => {
          void selectTask(row.id).then(() => {
            const toggle = get("auto-tasks-tab");
            if (selectedId === row.id && toggle?.getAttribute("aria-expanded") === "true") toggle.click();
          });
        });
        const badge = document.createElement("span");
        badge.className = "auto-task-badge";
        badge.textContent = st?.running ? "运行中" : row.error ? "读取失败" : !row.id ? "未保存" : selected ? "当前" : "已保存";
        item.append(select, badge);
      }
      const actions = document.createElement("div");
      actions.className = "auto-task-actions";
      if (row.id === selectedId) {
        (currentTask ? get("auto-task-fields") : actions).append(loopInput);
      } else if (!currentTask) {
        actions.append(otherRepeat!);
      }
      for (const [key, text, disabled, work] of [
        [
          "export",
          "导出",
          !backend.available && row.id !== selectedId && !drafts.has(row.id),
          () => exportScript(row.id),
        ],
        ["save", "保存", !backend.available, () => save(row.id)],
        ["delete", "删除", !backend.available || !row.id, () => remove(row.id)],
        [
          st?.running ? "stop" : "run",
          st?.running ? "停止" : "运行",
          !backend.available || !row.id,
          () => st?.running ? backend.action("task-stop", row.id) : start(row.id),
        ],
      ] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.dataset.taskId = row.id;
        button.dataset.taskAction = key;
        button.disabled = disabled || !!row.error;
        button.setAttribute(
          "aria-label",
          `${text}任务 ${row.id === selectedId ? selectedName : row.name}`,
        );
        button.addEventListener(
          "click",
          () =>
            void act(async () => {
              await work();
            }),
        );
        actions.append(button);
      }
      if (currentTask && row.id === selectedId) {
        const stop = document.createElement("button");
        stop.type = "button";
        stop.textContent = st?.running ? "运行" : "停止";
        stop.disabled = true;
        stop.setAttribute("aria-label", st?.running ? "任务正在运行" : "当前任务未运行");
        actions.append(stop);
        currentTask.append(actions);
      } else {
        if (currentTask) {
          const more = document.createElement("details");
          more.className = "auto-task-more";
          const summary = document.createElement("summary");
          summary.textContent = "更多";
          summary.setAttribute("aria-label", `更多操作 ${row.name}`);
          const menu = document.createElement("div");
          menu.className = "auto-task-more-menu";
          for (const button of [...actions.querySelectorAll<HTMLButtonElement>("button")]) {
            if (!["run", "stop"].includes(button.dataset.taskAction!)) menu.append(button);
          }
          more.append(summary, menu);
          actions.append(more);
        }
        item.append(actions);
      }
      list.append(item);
    }
    list.append(createCard);
    sizeList();
    list.scrollTop = scrollTop;
    if (editing) {
      active.focus({ preventScroll: true });
      if (caret !== null) active.setSelectionRange(caret, caret);
    } else if (focused) {
      const restored = [...list.querySelectorAll<HTMLInputElement>("button,input")]
        .find(
          (button) =>
            button.dataset.taskId === focused.taskId &&
            button.dataset.taskAction === focused.taskAction,
        );
      restored?.focus({ preventScroll: true });
      if (restored && caret !== null && restored.type === "text") restored.setSelectionRange(caret, caret);
    }
  }
  get("auto-tasks-tab")?.addEventListener("click", paint);
  async function act(work: () => Promise<void>) {
    try {
      await work();
      await refresh();
    } catch (error) {
      options.notify(String(error), true);
    }
  }
  function showDraft(id: string) {
    const draft = drafts.get(id);
    if (!draft) return false;
    options.render(draft.script);
    input("auto-task-name").value = draft.name;
    input("auto-task-interval").value = draft.interval;
    loopEnabled = draft.loop;
    input("auto-task-repeats").value = draft.repeatCount;
    return true;
  }
  async function switchTask(id: string) {
    const error = rows.find(row => row.id === id)?.error;
    if (error) throw new Error(error);
    const version = ++selectionVersion;
    if (id === selectedId) return;
    saveDraft();
    if (!drafts.has(id)) {
      const task = await backend.action<SavedTask>("task-load", id);
      if (version !== selectionVersion) return;
      drafts.set(id, {
        script: task.script,
        name: task.name,
        interval: String(task.intervalMs),
        loop: task.loop ?? false,
        repeatCount: String(task.repeatCount ?? (task.loop ? 0 : 1)),
      });
    }
    const edited = rowEdits.get(id);
    if (edited) {
      const draft = drafts.get(id)!;
      Object.assign(draft, edited, {loop: edited.repeatCount !== "1"});
      rowEdits.delete(id);
    }
    selectedId = id;
    showDraft(id);
    paint();
    options.highlight(statuses[id]);
  }
  async function selectTask(id: string) {
    try {
      await switchTask(id);
    } catch (error) {
      options.notify(String(error), true);
    }
  }
  function newTask(preserve = true) {
    if (preserve) saveDraft();
    ++selectionVersion;
    if (selectedId !== null) usedNames.add(input("auto-task-name").value);
    drafts.delete("");
    selectedId = "";
    draftIndex = 0;
    for (const row of rows) usedNames.add(row.name);
    for (const draft of drafts.values()) usedNames.add(draft.name);
    let name = "新任务",
      suffix = 0;
    while (usedNames.has(name)) name = `新任务${++suffix}`;
    usedNames.add(name);
    input("auto-task-name").value = name;
    input("auto-task-interval").value = "1000";
    loopEnabled = false;
    input("auto-task-repeats").value = "1";
    options.render({
      schemaVersion: 1,
      name,
      repeats: 1,
      maxRunSeconds: 86400,
      startDelayMs: 0,
      steps: [],
    });
    paint();
    options.highlight(undefined);
  }
  async function refresh(selectFirst = false) {
    if (!backend.available) return;
    const version = ++refreshVersion, selection = selectionVersion;
    const nextRows = await backend.action<TaskRow[]>("task-list");
    const nextStatuses =
      await backend.action<Record<string, AutomationStatus>>("task-statuses");
    if (version !== refreshVersion) return;
    rows = nextRows;
    statuses = nextStatuses;
    if (selectFirst && selectedId === null && rows.length && selection === selectionVersion && options.visible()) {
      await selectTask(rows[0].id);
    }
    paint();
    showResults();
  }
  function visibleRows(): TaskRow[] {
    const shown = [...rows], draft = drafts.get("");
    if (selectedId === "" || draft) shown.splice(Math.min(draftIndex,shown.length),0,{
      id:"",name:draft?.name ?? input("auto-task-name").value,intervalMs:Number(draft?.interval ?? 1000),
    });
    return shown;
  }
  async function reorder(from: string, to: string, after: boolean) {
    if (orderSaving) return;
    const previous = rows, oldIndex = draftIndex, shown = visibleRows();
    const next = moveTaskRows(shown,from,to,after);
    if (next === shown || next.every((row,index)=>row.id === shown[index].id)) {paint();return;}
    const draftPosition = next.findIndex(row=>row.id === "");
    if (draftPosition >= 0) draftIndex = draftPosition;
    const saved = next.filter(row=>row.id !== "");
    if (saved.every((row,index)=>row.id === previous[index].id)) {paint();return;}
    ++refreshVersion;
    orderSaving = true;
    rows = saved;
    paint();
    try { rows = await backend.action<TaskRow[]>("task-reorder", saved.map(row => row.id)); }
    catch (error) { rows = previous; draftIndex = oldIndex; options.notify(String(error), true); }
    finally { orderSaving = false; paint(); }
  }
  async function exportScript(id: string) {
    if (id === selectedId) saveDraft();
    const draft = drafts.get(id);
    const source = draft ?? (await backend.action<SavedTask>("task-load", id));
    const edited = rowEdits.get(id);
    await options.prepare?.(source.script);
    options.exportScript({ ...source.script, name: edited?.name ?? source.name, repeats: Number(edited?.repeatCount ?? source.repeatCount ?? (source.loop ? 0 : 1)) });
  }
  async function save(previousId: string) {
    const version = selectionVersion, savedPosition = draftIndex;
    if (previousId === selectedId) saveDraft();
    const originalDraft = drafts.get(previousId);
    let draft = originalDraft;
    if (!draft) {
      const loaded = await backend.action<SavedTask>("task-load", previousId);
      draft = {
        script: loaded.script,
        name: loaded.name,
        interval: String(loaded.intervalMs),
        loop: loaded.loop ?? false,
        repeatCount: String(loaded.repeatCount ?? (loaded.loop ? 0 : 1)),
      };
    }
    const edited = rowEdits.get(previousId);
    if (edited) draft = {...draft, ...edited, loop: edited.repeatCount !== "1"};
    const script = structuredClone(draft.script);
    await options.prepare?.(script);
    const name = draft.name.trim();
    const repeats = Number(draft.repeatCount);
    if (!draft.repeatCount.trim() || !Number.isInteger(repeats) || repeats < 0 || repeats > 100000) throw new Error("循环次数请输入0到100000之间的整数，0表示一直循环");
    let intervalMs = Number(draft.interval);
    if (!draft.loop && (!Number.isInteger(intervalMs) || intervalMs < 100 || intervalMs > 3600000)) intervalMs = 1000;
    if (
      !name ||
      !Number.isInteger(intervalMs) ||
      intervalMs < 100 ||
      intervalMs > 3600000
    )
      throw new Error("请填写任务名称及100–3600000毫秒间隔");
    const id = previousId || crypto.randomUUID();
    const task: SavedTask = {
      schemaVersion: 2,
      id,
      name,
      intervalMs,
      loop: repeats !== 1,
      repeatCount: repeats,
      script: { ...script, name },
    };
    try {
      await backend.action("task-save", task);
    } catch (error) {
      if (!/unknown field `(loop|repeatCount)`/.test(String(error))) throw error;
      const running = await backend.action<Record<string, AutomationStatus>>("task-statuses");
      if (Object.values(running).some((status) => status.running))
        throw new Error("旧引擎不支持循环开关，请先停止运行中的任务再保存；编辑内容已保留");
      await backend.action("release");
      if (!options.visible()) throw new Error("编辑内容已保留，请重新打开自动化助手后保存");
      await backend.action("open");
      await backend.action("task-save", task);
    }
    if (version === selectionVersion && selectedId === previousId) {
      selectedId = id;
      options.render({ ...script, name });
      drafts.delete(previousId);
    }
    if (drafts.get(previousId) === originalDraft && rowEdits.get(previousId) === edited) drafts.delete(previousId);
    if (rowEdits.get(previousId) === edited) rowEdits.delete(previousId);
    if (previousId === "") {
      try {
        const current = await backend.action<TaskRow[]>("task-list");
        const ids = current.filter(row=>row.id !== id).map(row=>row.id);
        ids.splice(Math.min(savedPosition,ids.length),0,id);
        await backend.action("task-reorder",ids);
      } catch(error) {options.notify("任务已保存，但排序保存失败："+String(error),true);}
    }
    await refresh();
    options.notify(
      statuses[id]?.running
        ? "任务已保存，运行中任务的修改下次启动生效"
        : "任务已保存",
    );
  }
  async function start(id: string) {
    const row = rows.find((row) => row.id === id);
    if (!row) throw new Error("请先保存任务");
    await backend.action("task-start", { id, bindings: options.bindings() });
  }
  get("auto-task-new").addEventListener("click", () => {
    try {
      newTask();
    } catch (error) {
      options.notify(String(error), true);
    }
  });
  async function remove(id: string) {
    const version = selectionVersion;
    await backend.action("task-delete", id);
    drafts.delete(id);
    rowEdits.delete(id);
    if (selectedId === id && version === selectionVersion) newTask(false);
    options.notify("任务已移入本地归档目录");
  }
  if (backend.available && backend.subscribe)
    void backend
      .subscribe((event) => {
        statuses[event.taskId] = event.status;
        options.running?.(Object.values(statuses).some(status => status.running));
        if (options.visible()) {
          paint();
          if (event.taskId === selectedId) options.highlight(event.status);
        }
      })
      .then((stop) => {
        if (disposed) stop();
        else stopListener = stop;
      })
      .catch((error) => options.notify(String(error), true));
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      window.removeEventListener("resize", sizeList);
      stopListener?.();
    },
    { once: true },
  );
  function showResults() {
    if (!selectedId) return false;
    options.highlight(statuses[selectedId]);
    return true;
  }
  paint();
  return {
    refresh,
    choices: () => rows.filter(row => !row.error && row.id !== selectedId).map(({id,name})=>({id,name})),
    selectedId: () => selectedId,
    showResults,
    clearSelection() {
      ++refreshVersion;
      dragging = undefined;
      saveDraft();
      ++selectionVersion;
      selectedId = null;
      paint();
      options.highlight(undefined);
    },
    importScript(script: TaskScript) {
      saveDraft();
      ++selectionVersion;
      selectedId = "";
      draftIndex = 0;
      drafts.delete("");
      options.render(script);
      input("auto-task-name").value = script.name;
      input("auto-task-interval").value = "1000";
      input("auto-task-repeats").value = String(script.repeats ?? 1);
      loopEnabled = (script.repeats ?? 1) !== 1;
      paint();
      options.highlight(undefined);
    },
  };
}
