import { regexCondition, readRegexCondition } from "./automation-condition";
import { confirmScale, rescaleScript, validScale } from "./automation-scale";
import { createMousePreview } from "./automation-mouse-preview";
import { createTemplatePointPicker } from "./automation-template-point";
import type { ImagePoint } from "./image-region";
import {
  actionIssues,
  confirmOcrNumericResult,
  requiredScriptVersion,
  setOcrNumbersOnly,
  setWaitDuration,
  switchMouseAction,
} from "./automation-action-draft";
import { formatKeys, windowName } from "./automation-step-summary";
import { createBlocklyEditor } from "./automation-blockly";
import { initAutomationToolbox } from "./automation-toolbox";
import { initAutomationHotkeys } from "./automation-hotkeys";
import { initAutomationTasks } from "./automation-tasks";
import { actionHelp } from "./automation-help";
import { parseBlocks } from "./automation-block-model";
import { chooseCaptureDirectory, openAuxiliary, closeAuxiliary, onAutomationSelection } from "./api";
import { showPage } from "./navigation";
import {
  desktop,
  automationAction,
  onAutomationState,
  type AutomationStatus,
  type BoundWindow,
  type ModuleInfo,
} from "./api";
type Action = { type: string; [key: string]: unknown };
export interface Step {
  inputs?: import("./automation-values").ValueInputs;
  annotation?: string;
  delayMs: number;
  randomDelayMs?: number;
  action: Action;
}
export interface Script {
  缩放?: number;
  schemaVersion: number;
  name: string;
  repeats: number;
  maxRunSeconds: number;
  startDelayMs: number;
  intervalMs?: number;
  steps: Step[];
}
const names: Record<string, string> = {
  wait: "等待",
  setWindow: "设置窗口",
  focus: "窗口切换",
  click: "鼠标点击",
  drag: "按住拖动",
  scroll: "滚轮滚动",
  key: "按键",
  text: "输入文本",
  ocr: "读取文字",
  match: "查找图片",
  capture: "保存截图",
  set: "设置变量",
  calculate: "计算变量",
  if: "如果",
  elseIf: "否则如果",
  else: "否则",
  endIf: "结束条件",
  loop: "循环",
  endLoop: "结束循环",
  break: "跳出循环",
  continue: "下一轮",
  label: "标签",
  goto: "跳转",
  assert: "条件停止",
  regex: "正则匹配",
  comment: "注解",
  notify: "提示",
  group: "分组",
};
export function initAutomationEditor(
  message: (text: string, error?: boolean) => void,
) {
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const input = (id: string) => get<HTMLInputElement>(id);
  const dialog = get<HTMLElement>("automation-dialog");
  initAutomationToolbox(dialog);
  let scriptText = "";
  const setup = get("auto-action-setup");
  const settingsDialog = document.createElement("dialog");
  settingsDialog.id = "auto-settings";
  settingsDialog.setAttribute("aria-labelledby", "auto-selected-action");
  const closeSettings = document.createElement("button");
  closeSettings.type = "button";
  closeSettings.className = "auto-settings-close";
  closeSettings.textContent = "×";
  closeSettings.setAttribute("aria-label", "关闭动作设置");
  settingsDialog.append(closeSettings);
  dialog.append(settingsDialog);
  const templatePointPicker = createTemplatePointPicker(dialog);
  const matchFirstRow = document.createElement("div");
  matchFirstRow.className = "match-settings-row";
  const matchSecondRow = matchFirstRow.cloneNode() as HTMLDivElement;
  setup.querySelector(".auto-composer-fields")!.append(matchFirstRow, matchSecondRow);
  const matchHomes = [get("auto-target").closest("label")!, get("auto-template-pick").closest(".auto-template-row")!, get("auto-save-position").closest("label")!].map(element => {
    const home = document.createComment("match settings");
    element.before(home);
    return {element, home};
  });
  closeSettings.onclick = finishSetup;
  settingsDialog.addEventListener("cancel", (event) => {
    if (event.target !== settingsDialog) return;
    event.preventDefault();
    finishSetup();
  });
  const composer = dialog.querySelector<HTMLElement>(".auto-composer")!;
  const inlinePopups: HTMLElement[] = [];
  setup.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => {
    const summary = details.querySelector("summary")!;
    const popup = document.createElement("div");
    popup.className = "auto-inline-popover";
    popup.popover = "auto";
    popup.setAttribute("aria-label", summary.textContent!.trim());
    popup.append(...[...details.children].filter((child) => child !== summary));
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = summary.textContent!.trim();
    toggle.popoverTargetElement = popup;
    const holder = document.createElement("div");
    holder.className = details.className;
    if (details.dataset.actions)
      holder.dataset.actions = details.dataset.actions;
    holder.append(toggle, popup);
    details.replaceWith(holder);
    inlinePopups.push(popup);
    toggle.addEventListener("click", (event) => {
      if (state.running) event.preventDefault();
    });
    popup.addEventListener("toggle", () => {
      if (!popup.matches(":popover-open")) return;
      const rect = toggle.getBoundingClientRect();
      popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 376))}px`;
      popup.style.top = `${rect.bottom + popup.offsetHeight + 4 < window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - popup.offsetHeight - 4)}px`;
    });
  });
  let editing:
    { step: Step; parent: HTMLElement; update: () => void } | undefined;
  let templateGeneration = 0;
  let reviewImportScale = false;
  function syncScale(scale: number) {
      if (!validScale(scale)) throw new Error("截图未包含缩放信息，请更新并重启客户端");
      // Preview needs script metadata, not a validated/connected executable graph.
      const script = read(scriptText);
      if (reviewImportScale && validScale(script.缩放) && script.缩放 !== scale &&
          !window.confirm(`检测到脚本使用者缩放不一样（${script.缩放}% → ${scale}%），是否修改成对应位置？`))
        throw new Error("已保留原坐标，请确认缩放后再选点");
      reviewImportScale = false;
      const previous = script.缩放;
      script.缩放 = scale;
      scriptText = JSON.stringify(script);
      if (validScale(previous) && previous !== scale) blocks.rescale(scale / previous);
      if (editing) fillStepFields(editing.step);
  }
  const ocrResult = document.createElement("pre");
  ocrResult.className = "ocr-inline-result";
  ocrResult.setAttribute("aria-live", "polite");
  setup.insertBefore(ocrResult, setup.querySelector(".auto-composer-submit"));
  const mousePreview = createMousePreview(setup, {
    scale: () => read(scriptText).缩放,
    prepare: syncScale,
    owner: () => editing?.step,
    locked: () => state.running || (editing?.step.action.type === "click" && editing.step.action.position !== undefined),
    capture: async () => {
      const owner = editing;
      const window = selected(input("auto-target").value);
      if (!window) return;
      const capture = async () => {
        const result = await request<{width:number;height:number;scale:number;snapshot?:string;png:string}>("preview", {window, fullWindow:true});
        if (!result.snapshot) throw new Error("截图引擎版本过旧");
        return result;
      };
      try { return await capture(); }
      catch (error) {
        if (!["缺少区域", "截图引擎版本过旧"].some(message => String(error).includes(message))) throw error;
        const statuses = await request<Record<string, AutomationStatus>>("task-statuses");
        const status = await request<AutomationStatus>("status");
        if (status.running || Object.values(statuses).some(s => s.running))
          throw new Error("请先停止任务，再刷新截图以更新旧引擎");
        await request("release");
        if (dialog.hidden) return;
        await request("open");
        if (editing !== owner) return;
        return capture();
      }
    },
    update: () => {
      if (!editing) return;
      previewGeneration++;
      ocrResult.textContent = "";
      fillStepFields(editing.step);
      editing.update();
      blocks.refreshValidation();
    },
  });
  const mouseToolbar = document.createElement("div");
  mouseToolbar.className = "mouse-toolbar";
  get("auto-selected-action").after(mouseToolbar);
  const mouseParameters = document.createElement("div");
  mouseParameters.className = "mouse-parameters";
  setup.querySelector(".auto-composer-fields")!.append(mouseParameters);
  const parameterHomes = ["button", "x", "y", "to-x", "to-y", "drag-duration", "scroll-direction", "scroll-count", "hold"].map(id => {
    const label = get(`auto-${id}`).closest("label")!;
    const home = document.createComment(id);
    label.before(home);
    return { label, home };
  });
  let testing = false;
  const testMouse = document.createElement("button");
  testMouse.type = "button";
  testMouse.textContent = "测试动作";
  testMouse.onclick = () => void task(async () => {
    if (testing && state.running) { status(await request<AutomationStatus>("stop")); return; }
    if (!editing || state.running) return;
    const action = structuredClone(editing.step.action);
    if (action.type === "click" && action.position !== undefined) throw new Error("请运行任务测试变量点击，先由查找图片生成位置");
    const window = selected(String(action.target));
    const issues = actionIssues(editing.step, () => !!window);
    if (issues.length) throw new Error(issues.join("；"));
    testing = true;
    try { status(await request<AutomationStatus>("test-action", {action, window, scale:read(scriptText).缩放})); }
    catch (error) { testing = false; throw error; }
  });
  const doneHome = get("auto-config-done").parentElement!;
  const actionGroups = [...get("auto-type").querySelectorAll("optgroup")].map(
    (group) => ({
      id: group.dataset.category,
      label: group.label,
      actions: [...group.querySelectorAll("option")]
        .filter(
          (option) =>
            !["else", "elseIf", "endIf", "endLoop", "drag", "scroll", "setWindow", "regex"].includes(option.value),
        )
        .map((option) => ({ type: option.value, name: option.textContent! })),
    }),
  );
  function parkSetup() {
    templatePointPicker.close();
    inlinePopups.forEach((popup) => { if (popup.hasAttribute("popover")) popup.hidePopover(); });
    settingsDialog.close();
    if (editing) clearPreview();
    if (editing) {
      editing.parent.hidden = true;
      editing.parent.dataset.expanded = "false";
      const params = editing.parent
        .previousElementSibling as HTMLElement | null;
      if (params?.classList.contains("block-fields"))
        params.hidden = get("auto-step-list").classList.contains("step-view");
      const description = editing.parent
        .closest(".block-header")
        ?.querySelector<HTMLElement>(".block-description");
      editing.parent.closest(".block-header")?.classList.remove("block-compact");
      if (description) description.textContent = description.title;
      editing.parent
        .closest(".block-header")
        ?.querySelector(".block-edit")
        ?.setAttribute("aria-expanded", "false");
    }
    editing = undefined;
    setup.hidden = true;
    composer.append(setup);
  }
  const slots = new Set(["A"]);
  const boundWindows = new Map<string, BoundWindow>();
  let activeSlot = "A";
  let tasksManager: ReturnType<typeof initAutomationTasks> | undefined;
  let hotkeys: ReturnType<typeof initAutomationHotkeys> | undefined;
  let tasksRunning = false;
  let available = false,
    busy = false,
    windowList: BoundWindow[] = [],
    template = "";
  let state: AutomationStatus = {
    running: false,
    phase: "idle",
    step: 0,
    executed: 0,
    error: null,
    variables: {},
    logs: [],
  };
  let unlisten: (() => void) | undefined;
  let disposed = false;
  function read(text?: string): Script {
    if (text === undefined) { blocks.flush(); text = scriptText; }
    const parsed = JSON.parse(text) as Script;
    if (
      ![1, 2, 3, 4].includes(parsed.schemaVersion) ||
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.steps) ||
      parsed.steps.length > 1000
    )
      throw new Error("脚本格式不支持");
    if (
      parsed.steps.some(
        (step) => !step.action || typeof step.action.type !== "string",
      )
    )
      throw new Error("每一步需要 action 和 type");
    if (requiredScriptVersion(parsed.steps) > parsed.schemaVersion)
      throw new Error("脚本版本与动作不匹配，原数据已保留");
    if (parsed.缩放 === null) delete parsed.缩放;
    if (parsed.缩放 !== undefined && !validScale(parsed.缩放)) throw new Error("脚本缩放必须为50–1000%");
    return parsed;
  }
  const blocks = createBlocklyEditor(get("auto-step-list"), {
    names,
    categories: actionGroups,
    scale: () => read(scriptText).缩放,
    running: () => state.running,
    update: (steps) => {
      const script = { ...JSON.parse(scriptText) as Script, steps };
      script.schemaVersion = Math.max(script.schemaVersion, requiredScriptVersion(steps));
      scriptText = JSON.stringify(script, null, 2);
    },
    notify: message,
    slots: () => [...slots].sort(),
    windows: () => windowList.map((window) => window.title),
    refreshWindows: () => available ? refresh() : Promise.resolve(),
    tasks: () => tasksManager?.choices() ?? [],
    refreshTasks: async () => available ? (await request<{id:string;name:string;error?:string}[]>("task-list")).filter(row => !row.error && row.id !== tasksManager?.selectedId()) : [],
    configure: configureStep,
    beforeRender: parkSetup,
    issues: (step) => actionIssues(step, (slot) => !!selected(slot, step)),
  });
  function render(script: Script) {
    parseBlocks(script.steps);
    if (!script.steps.length && script.缩放 === undefined) script.缩放 = Math.round(window.devicePixelRatio * 100);
    function collectTargets(steps: Step[]) {
      for (const step of steps) {
        const target = step.action.target;
        if (typeof target === "string" && /^[A-Z]$/.test(target))
          slots.add(target);
        if (step.action.type === "group" && Array.isArray(step.action.steps))
          collectTargets(step.action.steps as Step[]);
      }
    }
    slots.clear();
    slots.add("A");
    collectTargets(script.steps);
    renderWindows();
    scriptText = JSON.stringify(script, null, 2);
    input("auto-task-name").value = script.name;

    blocks.render(script.steps);
    controls();
  }
  render({
    schemaVersion: 1,
    name: "新任务",
    repeats: 1,
    maxRunSeconds: 3600,
    startDelayMs: 0,
    steps: [],
  });
  function controls() {
    hotkeys?.setDisabled(busy || state.running || tasksRunning || (desktop && !available));
    for (const id of ["auto-ocr-device", "auto-ocr-model"]) input(id).disabled = busy || (desktop && !available);
    testMouse.disabled = !available || busy || (state.running && !testing) || (editing?.step.action.type === "click" && editing.step.action.position !== undefined);
    testMouse.title = editing?.step.action.position !== undefined ? "请运行任务测试变量点击，先由查找图片生成位置" : "";
    testMouse.textContent = testing && state.running ? "停止测试" : "测试动作";
    blocks.setRunning(state.running);
    for (const id of [
      "auto-refresh",
      "auto-preview",
      "auto-ocr-test",
      "auto-template-pick",
      "auto-capture-directory",
    ])
      get<HTMLButtonElement>(id).disabled = !available || busy || state.running;
    get<HTMLButtonElement>("auto-template-point").disabled = !available || busy || state.running || !editing?.step.action.savePosition || !editing?.step.action.template;
    get<HTMLButtonElement>("auto-import").disabled = state.running;
    input("auto-task-name").disabled = state.running;
    setup
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")
      .forEach((control) => (control.disabled = state.running));
  }
  const logTabs = [get<HTMLButtonElement>("auto-recognition-tab"), get<HTMLButtonElement>("auto-execution-tab")];
  function selectLog(index: number) {
    logTabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      get(tab.getAttribute("aria-controls")!).hidden = i !== index;
    });
  }
  logTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectLog(index));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1-index;
      selectLog(next);
      logTabs[next].focus();
    });
  });
  function renderResults(next?: AutomationStatus) {
    get("auto-variables").textContent =
      next && Object.keys(next.variables).length
        ? JSON.stringify(next.variables, null, 2)
        : "暂无识别日志";
    get("auto-log").textContent =
      [...(next?.logs ?? []), ...(next?.error ? [next.error] : [])].join("\n") || "暂无执行日志";
  }
  function status(next: AutomationStatus) {
    if ((next.revision ?? 0) < (state.revision ?? 0)) return;
    state = next;
    blocks.highlight(next);
    get("automation-card-state").textContent = next.running
      ? "运行中"
      : "已安装";
    if (testing || !tasksManager?.showResults()) renderResults(next);
    if (testing && !next.running) {
      testing = false;
      if (!next.error) message(next.phase === "completed" ? "测试动作已执行" : "测试已停止");
    }
    if (next.error) message(next.error, true);
    controls();
  }
  async function request<T>(
    method: string,
    payload: unknown = null,
  ): Promise<T> {
    if (!available)
      throw new Error(
        desktop ? "自动化模块未安装" : "浏览器仅支持编辑，执行请使用桌面客户端",
      );
    return automationAction<T>(method, payload);
  }
  async function task(work: () => Promise<void>) {
    if (busy) return;
    busy = true;
    controls();
    try {
      await work();
    } catch (error) {
      if (!dialog.hidden) message(String(error), true);
    } finally {
      busy = false;
      controls();
    }
  }
  type OcrSettings = {schemaVersion:number;model:string;device:string};
  hotkeys = initAutomationHotkeys(dialog, {
    preview: !desktop,
    save: settings => request("hotkey-settings-save", settings),
  });
  let ocrSettings: OcrSettings = {schemaVersion:1,model:"small",device:"cpu"};
  function showOcrSettings() {
    input("auto-ocr-model").value = ocrSettings.model;
    input("auto-ocr-device").value = ocrSettings.device;
  }
  for (const id of ["auto-ocr-model", "auto-ocr-device"]) get(id).addEventListener("change", () => {
    const next = {schemaVersion:1,model:input("auto-ocr-model").value,device:input("auto-ocr-device").value};
    if (!desktop) { ocrSettings = next; return; }
    void task(async () => {
      try { ocrSettings = await request<OcrSettings>("ocr-settings-save", next); }
      finally { showOcrSettings(); }
    });
  });
  function selected(
    slot: string,
    step = editing?.step,
  ): BoundWindow | undefined {
    if (slot.startsWith("window:")) {
      const matches = windowList.filter(window => window.title === slot.slice(7));
      return matches.length === 1 ? matches[0] : undefined;
    }
    const binding = blocks.windowBinding(step, slot);
    if (binding.dynamic) {
      const matches = windowList.filter(
        (window) => window.title === binding.title,
      );
      return matches.length === 1 ? matches[0] : undefined;
    }
    const bound = boundWindows.get(slot);
    return windowList.find(
      (window) => window.hwnd === bound?.hwnd && window.pid === bound.pid,
    );
  }
  function renderWindows(previousTarget = input("auto-target").value) {
    const target = get<HTMLSelectElement>("auto-target");
    const legacy = editing?.step.action.type === "setWindow";
    const targets = legacy ? [...slots] : [...new Set(windowList.map(window => "window:" + window.title))];
    target.replaceChildren(new Option("请选择窗口", ""), ...targets.map(value => new Option(windowName(value), value)));
    if (previousTarget && !targets.includes(previousTarget) && previousTarget !== "__refresh")
      target.add(new Option(windowName(previousTarget) + "（原目标）", previousTarget));
    if (legacy) target.add(new Option("＋ 新建窗口", "__new"));
    else target.add(new Option("↻ 刷新窗口列表", "__refresh"));
    target.value = previousTarget;
    get("auto-window-label").textContent = "软件";
    const select = get<HTMLSelectElement>("auto-window-select");
    select.replaceChildren(new Option("请选择窗口", ""));
    for (const window of windowList)
      select.add(
        new Option(
          window.title + " · " + window.width + "×" + window.height,
          String(window.hwnd),
        ),
      );
    const bound =
      editing?.step.action.type === "setWindow"
        ? windowList.find(
            (window) => window.title === editing?.step.action.title,
          )
        : selected(activeSlot);
    if (bound) select.value = String(bound.hwnd);
    else if (
      editing?.step.action.type === "setWindow" &&
      editing.step.action.title
    )
      select.options[0].text =
        String(editing.step.action.title) + "（当前未找到）";
    else if (boundWindows.has(activeSlot))
      select.options[0].text = "原窗口已失效，请重新选择";
    blocks.refreshValidation();
  }
  input("auto-target").addEventListener("change", () => {
    if (input("auto-target").value === "__refresh") {
      input("auto-target").value = String(editing?.step.action.target ?? "");
      void refresh().catch(error => message(String(error), true));
      return;
    }
    if (input("auto-target").value === "__new") {
      const next = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find(
        (slot) => !slots.has(slot),
      );
      if (!next) return;
      slots.add(next);
      renderWindows();
      input("auto-target").value = next;
    }
    activeSlot = input("auto-target").value || activeSlot;
    renderWindows();
  });
  get("auto-window-select").addEventListener("change", () => {
    const window = windowList.find(
      (window) => String(window.hwnd) === input("auto-window-select").value,
    );
    if (editing?.step.action.type === "setWindow") {
      editing.step.action.title = window?.title ?? "";
      editing.step.action.target = input("auto-target").value || activeSlot;
      input("auto-target").value = String(editing.step.action.target);
      editing.update();
      blocks.refreshValidation();
      return;
    }
    if (window) {
      boundWindows.set(activeSlot, window);
      input("auto-target").value = activeSlot;
      input("auto-target").dispatchEvent(
        new Event("change", { bubbles: true }),
      );
    } else boundWindows.delete(activeSlot);
    blocks.refreshValidation();
  });
  async function refresh() {
    windowList = await request<BoundWindow[]>("windows");
    if (dialog.hidden) return;
    renderWindows();
  }
  let initialized = false;
  let editorGeneration = 0;
  let releaseTransition: Promise<unknown> = Promise.resolve();
  let initialization: Promise<void> = Promise.resolve();
  get("open-automation").addEventListener("click", () =>
    showPage("automation"),
  );
  dialog.addEventListener("activate", () => {
    void blocks.activate();
    const generation = editorGeneration;
    controls();
    if (initialized) return;
    if (available) {
      initialization = initialization
        .then(async () => {
          await releaseTransition;
          if (initialized || dialog.hidden || generation !== editorGeneration)
            return;
          await task(async () => {
            await request("open");
            if (dialog.hidden || generation !== editorGeneration) return;
            let ocrSettingsError = "";
            try { ocrSettings = await request<OcrSettings>("ocr-settings"); }
            catch (error) { ocrSettingsError = String(error); }
            await hotkeys!.load(() => request("hotkey-settings"));
            if (dialog.hidden || generation !== editorGeneration) return;
            showOcrSettings();
            await refresh();
            await tasksManager?.refresh(true);
            const next = await request<AutomationStatus>("status");
            if (generation !== editorGeneration) return;
            status(next);
            initialized = true;
            message(ocrSettingsError, !!ocrSettingsError);
          });
        })
        .catch((error) => {
          if (!dialog.hidden && generation === editorGeneration)
            message(String(error), true);
        });
    } else {
      initialized = true;
      message(
        desktop
          ? "自动化模块未安装，请使用完整安装包。"
          : "浏览器预览：可以编辑脚本，执行请打开桌面客户端。",
      );
    }
  });
  get("auto-refresh").addEventListener("click", () => {
    void task(refresh);
  });
  let previewGeneration = 0;
  function clearPreview() {
    templatePointPicker.close();
    previewGeneration++;
    ocrResult.textContent = "";
    mousePreview.reset();
    get("auto-selection-result").hidden = true;
    if (desktop) void closeAuxiliary().catch(() => {});
  }
  const form = (keepScreenshot = false) => {
    const type = input("auto-type").value;
    const mouse = ["click", "drag", "scroll"].includes(type);
    const ocr = ["ocr", "match", "capture"].includes(type);
    const visual = mouse || ocr;
    for (const {element,home} of matchHomes) home.after(element);
    matchFirstRow.hidden = matchSecondRow.hidden = type !== "match";
    setup.classList.toggle("match-settings", type === "match");
    setup.classList.toggle("mouse-settings", visual);
    setup.classList.toggle("ocr-settings", ocr);
    mouseToolbar.hidden = !visual;
    ocrResult.hidden = !ocr;
    testMouse.hidden = !mouse;
    if (ocr) mouseToolbar.append(get("auto-ocr-test"), mousePreview.refresh, get("auto-config-done"));
    mouseParameters.hidden = !mouse;
    for (const {label, home} of parameterHomes) {
      if (mouse) mouseParameters.append(label);
      else home.after(label);
    }
    for (const id of ["x", "y", "to-x", "to-y"]) {
      get(`auto-${id}`).closest("label")!.hidden = id.startsWith("to-") && type !== "drag";
    }
    if (mouse) mouseToolbar.append(testMouse, mousePreview.refresh, get("auto-config-done"));
    else if (!ocr) doneHome.append(get("auto-config-done"));
    if (visual) mouseToolbar.append(closeSettings);
    else settingsDialog.prepend(closeSettings);
    for (const popup of inlinePopups) {
      if (popup.hasAttribute("popover")) popup.hidePopover();
      if (visual) popup.removeAttribute("popover");
      else popup.popover = "auto";
      popup.classList.toggle("mouse-inline-fields", visual);
      (popup.previousElementSibling as HTMLElement).hidden = visual;
    }
    get("auto-action-setup").hidden = !editing;
    const extras = dialog.querySelector<HTMLElement>(
      ".auto-extra-settings > div",
    )!;
    dialog.querySelector<HTMLElement>(".auto-extra-settings")!.hidden = ![
      "click",
      "key",
      "ocr",
      "match",
    ].includes(type);
    (["ocr", "match"].includes(type)
      ? extras
      : get("auto-parameters")
    ).append(input("auto-variable").closest("label")!);
    get("auto-variable-label").textContent = "保存到变量";
    extras.append(input("auto-threshold").closest("label")!);
    extras.append(input("auto-numbers").closest(".auto-pair")!);
    get("auto-selected-action").textContent = ["click", "drag", "scroll"].includes(type) ? "鼠标操作" : names[type] ?? type;
    if (mouse) {
      const help = document.createElement("span");
      help.className = "mouse-usage";
      help.textContent = "在截图上点选位置或拖动。部分游戏不支持后台操作，可改用前台操作。";
      get("auto-selected-action").append(help);
    }
    input("auto-mouse-type").value = type;
    get("auto-action-help").textContent = actionHelp[type] ?? "";
    get("auto-value-label").textContent =
      (
        {
          text: "要输入的文字",
          comment: "备注内容",
          set: "要保存的值",
          label: "位置名称",
          goto: "跳到哪个位置",
          capture: "图片名称",
          assert: "停止提示",
          regex: "匹配规则（正则表达式）",
        } as Record<string, string>
      )[type] ?? "内容";
    if (!keepScreenshot) clearPreview();
    const regionMode = ["ocr", "match", "capture"].includes(type);
    get("auto-preview").textContent = regionMode ? "框选区域" : "截图选点";
    get("auto-preview").hidden = !regionMode || ocr;
    get("auto-ocr-test").hidden = type !== "ocr";
    get("auto-x-label").textContent = regionMode ? "左上角 X" : "X";
    get("auto-y-label").textContent = regionMode ? "左上角 Y" : "Y";
    dialog
      .querySelectorAll<HTMLElement>("[data-actions]")
      .forEach(
        (field) =>
          (field.hidden = !field.dataset.actions!.split(" ").includes(type)),
      );
    if (type === "match") {
      matchFirstRow.append(matchHomes[0].element, matchHomes[1].element, input("auto-threshold").closest("label")!);
      matchSecondRow.append(matchHomes[2].element, input("auto-variable").closest("label")!, get("auto-template-point-setting"));
    }
  };
  const picker = {
    select(type: string, keepScreenshot = false) {
      input("auto-type").value = type;
      form(keepScreenshot);
    },
  };
  const fieldKeys: Record<string, string> = {
    target: "target",
    button: "button",
    "mouse-mode": "mode",
    position: "position",
    "save-position": "savePosition",
    hold: "holdMs",
    "drag-duration": "durationMs",
    "scroll-direction": "delta",
    "scroll-count": "delta",
    variable: "variable",
    threshold: "threshold",
    count: "count",
    "group-name": "name",
    expression: "expression",
    numbers: "numbersOnly",
    reuse: "reuse",
    "to-x": "toX",
    "to-y": "toY",
  };
  function valueKey(type: string) {
    return (
      {
        text: "text",
        comment: "text",
        set: "value",
        label: "name",
        goto: "label",
        capture: "name",
        assert: "message",
        regex: "pattern",
      } as Record<string, string>
    )[type];
  }
  function fieldLocation(
    id: string,
    step: Step,
  ): [Record<string, unknown>, string] | undefined {
    const a = step.action,
      key = id.replace(/^auto-/, "");
    if (key === "wait") return [a, "ms"];
    if (key === "key") return [a, "keys"];
    if (key === "value")
      return valueKey(a.type) ? [a, valueKey(a.type)] : undefined;
    if (["x", "y", "width", "height"].includes(key)) {
      if (a.type === "drag") return [a, key === "x" ? "fromX" : "fromY"];
      return [(a.region as Record<string, unknown>) ?? a, key];
    }
    return fieldKeys[key] ? [a, fieldKeys[key]] : undefined;
  }
  function conditionFields(restore = false) {
    if (!editing) return;
    const conditional = ["if", "elseIf"].includes(editing.step.action.type);
    const kind = input("auto-condition-kind");
    if (restore && conditional) {
      const parsed = readRegexCondition(String(editing.step.action.expression ?? ""));
      kind.value = parsed ? "regex" : "expression";
      if (parsed) { input("auto-condition-source").value = parsed.source; input("auto-condition-pattern").value = parsed.pattern; }
    }
    const regex = conditional && kind.value === "regex";
    get("auto-condition-regex").hidden = !regex;
    input("auto-expression").closest("label")!.hidden = regex || !["if", "elseIf", "assert", "calculate"].includes(editing.step.action.type);
  }
  function fillStepFields(step: Step) {
    const point = step.action.templatePoint as ImagePoint | undefined;
    get("auto-template-point-value").textContent = point ? `(${point.x}, ${point.y})` : "图片中心";
    const directory = String(step.action.directory ?? "");
    get("auto-capture-path").textContent = directory || "默认位置";
    get("auto-capture-path").title = directory;
    conditionFields(true);
    for (const control of setup.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >("input,select")) {
      const location = fieldLocation(control.id, step);
      if (!location) continue;
      const value = location[0][location[1]];
      if (location[1] === "delta") {
        const delta = Number(value);
        if (control.id === "auto-scroll-direction") control.value = delta < 0 ? "-1" : "1";
        else {
          const count = Math.abs(delta) / 120;
          const select = control as HTMLSelectElement;
          select.replaceChildren(...Array.from({ length: 10 }, (_, i) => new Option(`${i + 1} 次`, String((i + 1) * 120))));
          if (!Number.isInteger(count) || count < 1 || count > 10)
            select.add(new Option(`${count} 次（原值）`, String(Math.abs(delta))));
          select.value = String(Math.abs(delta));
        }
        continue;
      }
      if (control instanceof HTMLInputElement && control.type === "checkbox")
        control.checked = !!value;
      else
        control.value =
          location[1] === "keys"
            ? formatKeys(value)
            : location[1] === "ms"
              ? String(
                  (Number(value) +
                    (step.action.type === "wait" ? step.delayMs || 0 : 0)) /
                    1000,
                )
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value ?? (location[1] === "mode" ? "foreground" : ""));
    }
    positionFields();
    get("auto-ocr-legacy-result").hidden = !(step.action.type === "ocr" && step.action.numbersOnly === true && step.action.numericResult !== true);
  }
  function positionFields() {
    const click = editing?.step.action.type === "click";
    const variable = click && editing?.step.action.position !== undefined;
    input("auto-position-source").value = variable ? "variable" : "point";
    get("auto-position-label").hidden = !variable;
    if (click) for (const id of ["auto-x", "auto-y"]) get(id).closest("label")!.hidden = variable;
    mousePreview.updateMode();
    mousePreview.refresh.hidden = !!variable;
    const help = get("auto-selected-action").querySelector(".mouse-usage");
    if (help) help.textContent = variable ? "先查找图片，再使用同一变量点击图片中心。" : "在截图上点选位置或拖动。部分游戏不支持后台操作，可改用前台操作。";
    controls();
  }
  function configureStep(step: Step, parent: HTMLElement, update: () => void) {
    parkSetup();
    editing = { step, parent, update };
    parent.closest(".block-header")?.classList.toggle("block-compact", ["if", "elseIf", "assert", "loop", "set", "calculate", "label", "goto"].includes(step.action.type));
    picker.select(step.action.type);
    renderWindows(String(step.action.target ?? ""));
    parent.replaceChildren(setup);
    const inline = parent.previousElementSibling as HTMLElement | null;
    if (inline?.classList.contains("block-fields")) inline.hidden = true;
    parent.hidden = false;
    parent.dataset.expanded = "true";
    parent
      .closest(".block-header")
      ?.querySelector(".block-edit")
      ?.setAttribute("aria-expanded", "true");
    setup.hidden = false;
    fillStepFields(step);
    template = String(step.action.template ?? "");
    get("auto-template-name").textContent = template ? "已选择模板" : "未选择";
    activeSlot = String(step.action.target || activeSlot);
    renderWindows();
    get("auto-add-feedback").textContent =
      "修改即时生效；红框表示还有设置未完成。";
    if (
      ![
        "wait",
        "comment",
        "label",
        "goto",
        "loop",
        "group",
        "if",
        "elseIf",
        "set",
        "calculate",
        "assert",
        "break",
        "continue",
      ].includes(step.action.type)
    ) {
      parent.hidden = true;
      parent.dataset.expanded = "false";
      settingsDialog.append(setup);
      settingsDialog.showModal();
    }
    [
      ...setup.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input, select",
      ),
    ]
      .find((control) => control.getClientRects().length)
      ?.focus({ preventScroll: true });
    controls();
    void mousePreview.load();
  }
  get("auto-mouse-type").addEventListener("change", () => {
    if (!editing || state.running) return;
    switchMouseAction(editing.step, input("auto-mouse-type").value);
    picker.select(editing.step.action.type, true);
    fillStepFields(editing.step);
    editing.update();
    blocks.refreshValidation();
    mousePreview.updateMode();
  });
  function updateSetup(event: Event) {
    if (!editing || state.running) return;
    const control = event.target;
    if (!(
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement
    ))
      return;
    if (["auto-condition-kind", "auto-condition-source", "auto-condition-pattern"].includes(control.id)) {
      conditionFields();
      if (input("auto-condition-kind").value === "regex") {
        editing.step.action.expression = regexCondition(input("auto-condition-source").value.trim(), input("auto-condition-pattern").value);
        input("auto-expression").value = String(editing.step.action.expression);
      }
      editing.update();
      blocks.refreshValidation();
      return;
    }
    if (control.id === "auto-position-source") {
      if ((control.value === "variable") === (editing.step.action.position !== undefined)) return;
      if (control.value === "variable") editing.step.action.position = "result";
      else delete editing.step.action.position;
      fillStepFields(editing.step);
      editing.update();
      blocks.refreshValidation();
      if (control.value === "point") void mousePreview.load();
      return;
    }
    const location = fieldLocation(control.id, editing.step);
    if (!location) return;
    const [object, key] = location;
    let value: unknown = control.value;
    if (key === "delta")
      value = Number(input("auto-scroll-direction").value) * Number(input("auto-scroll-count").value);
    if (control instanceof HTMLInputElement && control.type === "checkbox")
      value = control.checked;
    else if (control instanceof HTMLInputElement && control.type === "number")
      value = control.value === "" ? -1 : Number(control.value);
    if (key === "ms") value = Math.round(Number(value) * 1000);
    if (key === "keys") {
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
      value = control.value
        .toUpperCase()
        .split("+")
        .map((part) => {
          const k = part.trim();
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
    if (key === "value") {
      try {
        value = JSON.parse(control.value);
      } catch {
        /* Literal text value. */
      }
    }
    if (key === "numbersOnly" && editing.step.action.type === "ocr") {
      setOcrNumbersOnly(editing.step, value === true);
      get("auto-ocr-legacy-result").hidden = true;
    } else if (key === "ms" && editing.step.action.type === "wait")
      setWaitDuration(editing.step, Number(value));
    else object[key] = value;
    if (["ocr", "match", "capture"].includes(editing.step.action.type)) { previewGeneration++; ocrResult.textContent = ""; mousePreview.updateMode(); }
    editing.update();
    blocks.refreshValidation();
    if (key === "savePosition") controls();
  }
  setup.addEventListener("input", updateSetup);
  setup.addEventListener("change", updateSetup);
  function finishSetup() {
    if (editing?.step.action.type === "ocr" && editing.step.action.numbersOnly === true && editing.step.action.numericResult !== true) {
      confirmOcrNumericResult(editing.step);
      editing.update();
    }
    const button = editing?.parent
      .closest(".block-header")
      ?.querySelector<HTMLButtonElement>(".block-edit");
    parkSetup();
    button?.focus();
  }
  get("auto-config-done").addEventListener("click", finishSetup);
  input("auto-task-name").addEventListener("input", () => {
    try {
      const script = read();
      script.name = input("auto-task-name").value;
      scriptText = JSON.stringify(script, null, 2);
    } catch (error) {
      message(String(error), true);
    }
  });
  async function importScale(script: Script, importing = true): Promise<boolean> {
    if (!validScale(script.缩放)) { if (importing) message("脚本没有缩放记录，保留原坐标；无法判断原始比例。"); return true; }
    if (importing) reviewImportScale = true;
    if (!available) return true;
    const windows = await request<BoundWindow[]>("windows");
    const titles: string[] = [];
    const visit = (steps: Step[]) => { for (const step of steps) {
      if (step.action.type === "setWindow") titles.push(String(step.action.title));
      if (String(step.action.target ?? "").startsWith("window:")) titles.push(String(step.action.target).slice(7));
      if (step.action.type === "group") visit(step.action.steps as Step[]);
    }};
    visit(script.steps);
    const target = titles.map(title => windows.filter(w => w.title === title)).find(matches => matches.length === 1)?.[0];
    if (!target) {if (importing) message("尚未找到脚本目标窗口，打开鼠标设置后会检测缩放。"); return true;}
    const scale = await request<number>("window-metrics", target);
    if (scale !== script.缩放) {
      if (importing || reviewImportScale) {
        if (!confirmScale(script, scale, message => window.confirm(message))) return false;
      } else rescaleScript(script, scale);
    }
    reviewImportScale = false;
    return true;
  }
  function exportScript(script: Script) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({缩放:script.缩放 ?? null, ...script}, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "moligod-automation.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  get("auto-import").addEventListener("click", () =>
    input("auto-script-file").click(),
  );
  input("auto-script-file").addEventListener("change", () => {
    void (async () => {
      try {
        const file = input("auto-script-file").files?.[0];
        if (!file) return;
        if (file.size > 1024 * 1024) throw new Error("脚本文件超过 1 MiB");
        const script = read(await file.text());
        const previousReview = reviewImportScale;
        try { if (!await importScale(script)) {reviewImportScale = previousReview; return;} }
        catch (error) {reviewImportScale = previousReview; throw error;}
        tasksManager!.importScript(script);
        message("已导入为新任务，确认后保存任务。");
      } catch (error) {
        message(String(error), true);
      } finally {
        input("auto-script-file").value = "";
      }
    })();
  });
  get("auto-capture-directory").addEventListener("click", () => {
    void task(async () => {
      const owner = editing;
      const action = owner?.step.action;
      if (!owner || action?.type !== "capture" || state.running) return;
      const directory = await chooseCaptureDirectory();
      if (!directory || editing !== owner || editing.step.action !== action || state.running) return;
      action.directory = directory;
      fillStepFields(owner.step);
      owner.update();
    });
  });
  get("auto-template-pick").addEventListener("click", () =>
    input("auto-template-file").click(),
  );
  input("auto-template-file").addEventListener("change", () => {
    const generation = ++templateGeneration;
    void task(async () => {
      try {
        const owner = editing;
        const action = owner?.step.action;
        const file = input("auto-template-file").files?.[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) throw new Error("模板超过 8 MiB");
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let start = 0; start < bytes.length; start += 8192)
          binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
        const response = await request<{ id: string }>(
          "import-template",
          btoa(binary),
        );
        if (editing !== owner || generation !== templateGeneration) return;
        if (editing?.step.action !== action || action?.type !== "match") return;
        template = response.id;
        if (editing) {
          editing.step.action.template = template;
          delete editing.step.action.templatePoint;
          fillStepFields(editing.step);
          editing.update();
        }
        get("auto-template-name").textContent = file.name;
        controls();
      } finally {
        input("auto-template-file").value = "";
      }
    });
  });
  get("auto-template-point").addEventListener("click", () => {
    void task(async () => {
      const owner = editing;
      const action = owner?.step.action;
      if (!owner || action?.type !== "match" || !action.savePosition || !action.template || state.running) return;
      const id = action.template;
      const result = await request<{png:string}>("template-image", id);
      if (editing !== owner || owner.step.action !== action || action.template !== id || state.running) return;
      await templatePointPicker.open(result.png, action.templatePoint as ImagePoint | undefined, point => {
        if (editing !== owner || owner.step.action !== action || action.template !== id || state.running) return;
        action.templatePoint = point;
        fillStepFields(owner.step);
        owner.update();
      });
    });
  });
  input("auto-target").addEventListener("change", () => { clearPreview(); void mousePreview.load(); });
  get("auto-window-select").addEventListener("change", clearPreview);
  get("auto-refresh").addEventListener("click", clearPreview);
  dialog.addEventListener("close", clearPreview);
  dialog.addEventListener("deactivate", clearPreview);
  dialog.addEventListener("deactivate", blocks.cancelDrag);
  dialog.addEventListener("close", blocks.cancelDrag);
  get("auto-preview").addEventListener("click", () => {
    void task(async () => {
      const window = selected(input("auto-target").value);
      if (!window) throw new Error("请先绑定目标窗口");
      const owner = editing;
      const scale = await request<number>("window-metrics", window);
      if (editing !== owner) return;
      syncScale(scale);
      const token = ++previewGeneration;
      await openAuxiliary(
        input("auto-type").value === "click"
          ? "point"
          : "region",
        token,
        {
          window,
          region: { x: 0, y: 0, width: window.width, height: window.height },
        },
      );
    });
  });
  let unlistenSelection: (() => void) | undefined;
  if (desktop)
    void onAutomationSelection((event) => {
      if (dialog.hidden || !editing || event.token !== previewGeneration)
        return;
      for (const [field, value] of Object.entries(event.selection)) {
        input("auto-" + field).value = String(value);
        input("auto-" + field).dispatchEvent(
          new Event("input", { bubbles: true }),
        );
      }
      const result = get("auto-selection-result");
      result.hidden = false;
      const r = event.selection;
      result.textContent =
        event.mode === "point"
          ? `坐标 (${r.x}, ${r.y})`
          : `左上 (${r.x}, ${r.y}) → 右下 (${r.x! + r.width!}, ${r.y! + r.height!}) · ${r.width} × ${r.height}`;
      message("");
    })
      .then((stop) => {
        if (disposed) stop();
        else unlistenSelection = stop;
      })
      .catch((error) => message(String(error), true));
  get("auto-ocr-test").addEventListener("click", () => {
    void task(async () => {
      const owner = editing;
      if (!owner || state.running) return;
      const token = ++previewGeneration;
      const button = get<HTMLButtonElement>("auto-ocr-test");
      button.disabled = true;
      ocrResult.textContent = "正在识别…";
      try {
        const selection = mousePreview.selection();
        const result = await request<{text?:string}>("ocr-test", {...selection,numbersOnly:!!owner.step.action.numbersOnly,numericResult:!!owner.step.action.numericResult});
        if (editing !== owner || token !== previewGeneration) return;
        ocrResult.textContent = result.text || (owner.step.action.numbersOnly ? (owner.step.action.numericResult ? "该区域未识别到数字（结果为空值）" : "该区域未识别到数字") : "该区域未识别到文字");
      } catch (error) {
        if (editing === owner && token === previewGeneration) ocrResult.textContent = "识别失败：" + String(error);
      } finally { button.disabled = false; }
    });
  });
  dialog.addEventListener("close", () => {
    editorGeneration++;
    initialized = false;
    try { tasksManager?.clearSelection(); }
    catch (error) { message(String(error), true); }
    if (desktop)
      releaseTransition = automationAction("release").catch(() => {});
  });
  if (desktop)
    void onAutomationState(status)
      .then((stop) => {
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
        void automationAction<AutomationStatus>("status")
          .then(status)
          .catch((error) => message(String(error), true));
      })
      .catch((error) => message(String(error), true));
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      blocks.cancelDrag();
      blocks.dispose();
      unlisten?.();
      unlistenSelection?.();
    },
    { once: true },
  );
  tasksManager = initAutomationTasks({
    running: running => { tasksRunning = running; controls(); },
    read,
    exportScript,
    prepare: async script => {if (!await importScale(script, false)) throw new Error("已取消，原脚本未修改");},
    render,
    bindings: () =>
      Object.fromEntries(
        [...slots].flatMap((slot) => {
          const found = selected(slot);
          return found ? [[slot, found]] : [];
        }),
      ),
    notify: message,
    visible: () => !dialog.hidden,
    selection: (active, hasTasks) => {
      controls();
      get("auto-step-list").closest("section")!.hidden = !active;
      const empty = get("auto-editor-empty");
      empty.hidden = active;
      get("auto-empty-title").textContent = hasTasks
        ? "请先打开任务"
        : "请先创建任务";
      get("auto-empty-hint").textContent = hasTasks
        ? "从顶部“任务列表”选择任务，查看和编辑执行步骤"
        : "打开顶部“任务列表”，新建或导入任务，开始编排执行步骤";
    },
    highlight: (next) => {
      blocks.highlight(next);
      renderResults(next);
    },
  });
  controls();
  return {
    setInstalled(info: ModuleInfo | undefined) {
      available = desktop && Boolean(info?.installed);
      get("automation-card-state").textContent = info?.installed
        ? "已安装"
        : desktop
          ? "未安装"
          : "桌面工具";
      controls();
    },
  };
}
