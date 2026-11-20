import * as Blockly from "blockly/core";
import {
  ScrollOptions,
  ScrollBlockDragger,
  ScrollMetricsManager,
} from "@blockly/plugin-scroll-options";
import {
  registerBlocks,
  services,
  configuredActions,
  type ActionBlock,
} from "./automation-blockly-blocks.ts";
import {
  ACTION_BLOCK,
  START_BLOCK,
  scriptToWorkspace,
  workspaceToScript,
  encodeNodes,
  type ActionState,
  type BlockState,
  decodeSlots,
} from "./automation-blockly-codec.ts";
import { valueServices, type ReporterBlock } from "./automation-blockly-values.ts";
import { VALUE_BLOCK } from "./automation-values.ts";
import { ValueConnectionChecker } from "./automation-blockly-snap.ts";
import { newBlock } from "./automation-block-model.ts";
import { actionDraft } from "./automation-action-draft.ts";
import { scaleAction } from "./automation-scale.ts";
import type { BlocklyOptions } from "./automation-blockly.ts";
import type { Step } from "./automation-editor";
import { actionToolbox } from "./automation-blockly-toolbox.ts";
import { createWorkspaceControls } from "./automation-blockly-controls.ts";
import { CommentField, createCommentShortcut, renderAnnotation } from "./automation-blockly-comment.ts";
import { explicitInputWindows } from "./automation-input-migration.ts";
import { installFlyoutPickup } from "./automation-blockly-pickup.ts";
import { DockedToolbox, DockedFlyout } from "./automation-blockly-dock.ts";
import { installActionSelection } from "./automation-blockly-selection.ts";
import { installComponents } from "./automation-blockly-components.ts";
import { installWarningDismissal } from "./automation-warning-dismissal.ts";

registerBlocks();
// Zelos normally pushes the first editable field past the statement notch.
// Keep the keyboard action row compact around its editable fields.
class CompactKeyInfo extends Blockly.zelos.RenderInfo {
  private isKeyboard() { return this.block_.type === ACTION_BLOCK && !!this.block_.getField("keyMode"); }
  protected override adjustXPosition_() {
    if (this.isKeyboard()) return;
    super.adjustXPosition_();
  }
  override getSpacerRowHeight_(previous: Blockly.blockRendering.Row, next: Blockly.blockRendering.Row) {
    const height = super.getSpacerRowHeight_(previous, next);
    return this.isKeyboard() && previous === this.topRow ? height + 8 : height;
  }
}
class CompactKeyRenderer extends Blockly.zelos.Renderer {
  protected override makeRenderInfo_(block: Blockly.BlockSvg) { return new CompactKeyInfo(this, block); }
  override render(block: Blockly.BlockSvg) {
    super.render(block);
    if (block.type !== ACTION_BLOCK || block.workspace.isFlyout || block.isInsertionMarker()) return;
    const edit = services.get(block.workspace)?.editAnnotation;
    if (edit) renderAnnotation(block as ActionBlock, edit);
  }
}
Blockly.blockRendering.register("moligod-compact", CompactKeyRenderer);
// Blockly reserves five pixels around the handle: 9px gives a 4px visible bar.
Blockly.Scrollbar.scrollbarThickness = 9;
class CancellableScrollDragger extends ScrollBlockDragger {
  private provisional = false;
  override onDrag(event:PointerEvent,delta:Blockly.utils.Coordinate) {
    if(!this.provisional) return super.onDrag(event,delta);
    // A new palette card must not pan the canvas as its bounds cross the dock.
    const enabled=ScrollBlockDragger.edgeScrollEnabled;
    this.stopAutoScrolling();
    ScrollBlockDragger.edgeScrollEnabled=false;
    try {super.onDrag(event,delta);}
    finally {ScrollBlockDragger.edgeScrollEnabled=enabled;}
  }
  override onDragStart(event?: PointerEvent | KeyboardEvent) {
    this.provisional = this.draggable instanceof Blockly.BlockSvg && this.draggable.workspace.isFlyout;
    if (!this.provisional) return super.onDragStart(event);
    // A palette copy is provisional until dropped. It must not clear redo or
    // create a trash entry/empty undo action when the user cancels placement.
    const view=(this.draggable as Blockly.BlockSvg).workspace.targetWorkspace;
    const scroll=view ? {x:view.scrollX,y:view.scrollY} : undefined;
    Blockly.Events.disable();
    try {
      const result=super.onDragStart(event);
      if(view && scroll) {
        const before={x:view.scrollX,y:view.scrollY};
        view.scrollX=scroll.x;
        view.scrollY=scroll.y;
        const origin=view.getMetricsManager().getAbsoluteMetrics();
        view.translate(scroll.x+origin.left,scroll.y+origin.top);
        this.moveBlockWhileDragging(view.scrollX-before.x,view.scrollY-before.y);
      }
      return result;
    }
    finally { Blockly.Events.enable(); }
  }
  override onDragEnd(event: PointerEvent) {
    if (this.provisional && this.draggable instanceof Blockly.BlockSvg) {
      Blockly.Events.fire(new Blockly.Events.BlockCreate(this.draggable));
      this.provisional = false;
    }
    super.onDragEnd(event);
  }
  override onDragRevert(event?: PointerEvent | KeyboardEvent) {
    this.stopAutoScrolling();
    if (!this.provisional) {super.onDragRevert(event);return;}
    Blockly.Events.disable();
    try {super.onDragRevert(event);}
    finally {this.provisional = false;Blockly.Events.enable();}
  }
}
const theme = Blockly.Theme.defineTheme("moligod", {
  name: "moligod",
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: "#101113",
    toolboxBackgroundColour: "#1b1c1f",
    toolboxForegroundColour: "#dddde0",
    flyoutBackgroundColour: "#222326",
    flyoutForegroundColour: "#dddde0",
    flyoutOpacity: 1,
    scrollbarColour: "#a1a1a8",
    scrollbarOpacity: 0.35,
    insertionMarkerColour: "#c3c3c9",
    insertionMarkerOpacity: 0.6,
    cursorColour: "#c3c3c9",
  },
  fontStyle: {
    family: '"Microsoft YaHei", sans-serif',
    weight: "normal",
    size: 12,
  },
});

export function createBlocklyWorkspace(
  root: HTMLElement,
  options: BlocklyOptions,
) {
  root.replaceChildren();
  root.classList.remove("step-view");
  root.classList.add("auto-blockly");
  root.classList.toggle(
    "auto-blockly-with-toolbox",
    !!options.categories?.length,
  );
  const host = document.createElement("div");
  host.className = "auto-blockly-canvas";
  const warning = document.createElement("div");
  warning.className = "auto-blockly-warning";
  warning.setAttribute("role", "status");
  warning.hidden = true;
  const settingsHome = document.createElement("div");
  settingsHome.hidden = true;
  root.append(host, warning, settingsHome);
  const workspace = Blockly.inject(host, {
    theme,
    renderer: "moligod-compact",
    sounds: false,
    media: "/blockly/",
    toolbox: options.categories?.length
      ? actionToolbox(options.categories)
      : undefined,
    toolboxPosition: "start",
    plugins: {
      connectionChecker: ValueConnectionChecker,
      toolbox: DockedToolbox,
      flyoutsVerticalToolbox: DockedFlyout,
      blockDragger: CancellableScrollDragger,
      metricsManager: ScrollMetricsManager,
    },
    trashcan: false,
    collapse: true,
    comments: false,
    disable: false,
    move: { scrollbars: true, drag: true, wheel: true },
    zoom: {
      controls: false,
      wheel: true,
      startScale: 0.9,
      maxScale: 1.5,
      minScale: 0.3,
      scaleSpeed: 1.1,
    },
    grid: { spacing: 24, length: 2, colour: "#292a2e", snap: false },
  });
  const scrolling = new ScrollOptions(workspace);
  const flyout = workspace.getFlyout();
  if (flyout instanceof Blockly.Flyout) flyout.setAutoClose(false);
  const pickup = installFlyoutPickup(host, workspace);
  const actionSelection = installActionSelection(
    host, workspace, options.notify, createCommentShortcut(block => {
      if (!running && !options.running()) renderAnnotation(block, editAnnotation, true);
    }),
  );
  const components = installComponents(workspace, actionSelection.roots, () => options.scale?.(), options.notify, options.componentBackend);
  const disposeWarningDismissal = installWarningDismissal(workspace, options.notify);
  scrolling.init({
    edgeScrollOptions: {
      slowMouseStartDistance: -36,
      fastMouseStartDistance: 0,
      slowMouseSpeed: 0.3,
      fastMouseSpeed: 0.7,
      slowBlockSpeed: 0.2,
      fastBlockSpeed: 0.6,
    },
  });
  let loading = false,
    publishing = false,
    running = false,
    taskRunning = false,
    loadError = "",
    lastPublished = "";
  let selected: string | undefined;
  let configured: { id: string; step: Step } | undefined;
  let clearQuerySettings=()=>{};
  let validating: { id: string; step: Step } | undefined;
  let validationOrder: { step: Step; id: string }[] | undefined;
  let positionStart = false;
  let pendingMigration: Step[] | undefined;
  const rawState = () =>
    (Blockly.serialization.workspaces.save(workspace).blocks
      ?.blocks as BlockState[]) ?? [];
  const actions = () =>
    workspace
      .getAllBlocks(false)
      .filter(
        (b) => b.type === ACTION_BLOCK && !b.isInsertionMarker(),
      ) as ActionBlock[];
  function warn(text = "") {
    warning.textContent = text;
    warning.hidden = !text;
  }
  function flush() {
    if (publishing || loading) return;
    if (loadError) throw new Error(loadError);
    if (pickup.active() || actionSelection.active() || workspace.isDragging()) throw new Error("请先放下积木，或按 Esc 取消。");
    const steps = workspaceToScript(rawState());
    const encoded = JSON.stringify(steps);
    if (encoded !== lastPublished) {
      publishing = true;
      try {
        options.update(steps);
        lastPublished = encoded;
      } finally {
        publishing = false;
      }
    }
    warn();
  }
  function refreshValidation() {
    if (loading) return;
    validationOrder = ordered();
    try {
      for (const block of actions()) {
        const step = block.readState().step;
        try {decodeSlots(Blockly.serialization.blocks.save(block)! as BlockState,step);} catch { /* The save warning reports incomplete value connections. */ }
        validating = { id: block.id, step };
        let issues: string[];
        try {
          issues = options.issues?.(step) ?? [];
        } finally {
          validating = undefined;
        }
        block.setWarningText(
          issues.length ? issues.join("；") : null,
          "parameters",
        );
        (block as Blockly.BlockSvg)
          .getSvgRoot()
          ?.classList.toggle("auto-blockly-invalid", issues.length > 0);
      }
      for(const block of workspace.getAllBlocks(false).filter(b=>b.type===VALUE_BLOCK) as ReporterBlock[]) {
        const value=block.readValue();
        const issues=value.kind==="query" ? options.issues?.({delayMs:0,action:value.action})??[] : [];
        block.setWarningText(issues.length?issues.join("；"):null,"parameters");
      }
    } finally {
      validationOrder = undefined;
    }
  }
  function publish() {
    if (loading || running || pickup.active() || actionSelection.active() || workspace.isDragging()) return;
    try {
      flush();
    } catch (error) {
      warn(String(error).replace(/^Error: /, ""));
    }
    refreshValidation();
  }
  function mutate(block: ActionBlock, state: ActionState) {
    const before = JSON.stringify(block.readState());
    Blockly.Events.disable();
    try {
      block.shape(state);
      (block as Blockly.BlockSvg).render();
    } finally {
      Blockly.Events.enable();
    }
    publishMutation(block, before);
  }
  function publishMutation(block: ActionBlock, before: string) {
    const after = JSON.stringify(block.readState());
    if (before !== after)
      Blockly.Events.fire(
        new Blockly.Events.BlockChange(block, "mutation", null, before, after),
      );
    publish();
  }
  function branch(block: ActionBlock, kind: "elseIf" | "else" | "remove") {
    if (running) return;
    const state = block.readState(),
      branches = state.branches!;
    if (kind === "remove") {
      if (branches.length < 2) return;
      if (
        block.getInputTargetBlock("BODY_" + branches[branches.length - 1].key)
      ) {
        options.notify("请先移出该分支内的动作，再移除分支。", true);
        return;
      }
      branches.pop();
    } else {
      const otherwise = branches.findIndex(
        (b) => b.head?.action.type === "else",
      );
      if (kind === "else" && otherwise >= 0) return;
      const key = String(Math.max(...branches.map((b) => Number(b.key))) + 1);
      branches.splice(otherwise < 0 ? branches.length : otherwise, 0, {
        key,
        head: actionDraft(kind),
      });
    }
    mutate(block, state);
  }
  function editComment(block: ActionBlock, value: string) {
    if (running || block.workspace !== workspace) return;
    const before = JSON.stringify(block.readState());
    block.getField("text")?.setValue(value, false);
    block.payload.step.action.text = value;
    publishMutation(block, before);
  }
  function editAnnotation(block: ActionBlock, value: string) {
    if (workspace.isReadOnly()) return;
    const before = JSON.stringify(block.readState());
    if (value) block.payload.step.annotation = value;
    else delete block.payload.step.annotation;
    publishMutation(block, before);
  }
  const complex = configuredActions;
  function configure(block: ActionBlock) {
    if (running || block.workspace !== workspace) return;
    if (!complex.has(block.readState().step.action.type)) return;
    clearQuerySettings();
    const step = block.readState().step;
    configured = { id: block.id, step };
    options.configure?.(step, settingsHome, () => {
      if (!workspace.getBlockById(block.id) || running) return;
      mutate(block, { ...block.readState(), step });
    });
  }
  services.set(workspace, {
    names: options.names,
    windows: options.windows ?? (() => []),
    slots: options.slots,
    tasks: options.tasks,
    refreshTasks: async () => {
      try { return await options.refreshTasks?.() ?? options.tasks?.() ?? []; }
      catch (error) { options.notify(String(error),true); throw error; }
    },
    configure,
    saveComponent: block => { actionSelection.selectForContext(block); components.save(); },
    editComment,
    editAnnotation,
    branch,
    refresh: async () => {
      try {
        await options.refreshWindows?.();
        refreshValidation();
      } catch (error) {
        options.notify(String(error), true);
        throw error;
      }
    },
  });
  const queryServices={configure:(block:ReporterBlock)=>{
    if(running || block.workspace!==workspace || block.payload.kind!=="query") return;
    clearQuerySettings();
    const step:Step={delayMs:0,action:structuredClone(block.payload.action)};
    let parent:Blockly.Block|null=block;
    while(parent && parent.type!==ACTION_BLOCK) parent=parent.getParent();
    configured={id:parent?.id??block.id,step};
    options.configure?.(step,settingsHome,()=>{
      if(running || !workspace.getBlockById(block.id)) return;
      const before=JSON.stringify({value:block.readValue()});
      if(step.action.type==="match") step.action.savePosition=false;
      if(step.action.type==="ocr") step.action.reuse=false;
      block.shape({kind:"query",action:structuredClone(step.action)});block.render();
      Blockly.Events.fire(new Blockly.Events.BlockChange(block,"mutation",null,before,JSON.stringify({value:block.readValue()})));
      publish();
    });
    const settings=root.ownerDocument.getElementById("auto-settings");
    const fields=["auto-variable","auto-reuse","auto-save-position"].flatMap(id=>{
      const label=root.ownerDocument.getElementById(id)?.closest("label");
      return label?[{label,hidden:label.hidden}]:[];
    });
    for(const field of fields) field.label.hidden=true;
    const feedback=root.ownerDocument.getElementById("auto-add-feedback");
    if(feedback) feedback.textContent="每次检查都会重新查询，结果直接用于当前积木。";
    const restore=()=>{
      for(const field of fields) field.label.hidden=field.hidden;
      settings?.removeEventListener("close",restore);
      clearQuerySettings=()=>{};
    };
    clearQuerySettings=restore;
    settings?.addEventListener("close",restore,{once:true});
  }};
  valueServices.set(workspace,queryServices);
  if (options.categories?.length) {
    const flyoutWorkspace = workspace.getFlyout()?.getWorkspace();
    if (flyoutWorkspace)
      services.set(flyoutWorkspace, services.get(workspace)!);
    workspace.updateToolbox(actionToolbox(options.categories));
  }
  const controls = createWorkspaceControls(root, workspace, options.names);
  function render(steps: Step[]) {
    actionSelection.clear();
    controls.close();
    options.beforeRender?.();
    configured = undefined;
    cancelDrag();
    loading = true;
    selected = undefined;
    loadError = "";
    positionStart = !!options.categories?.length;
    created.clear();
    Blockly.Events.disable();
    try {
      const idle = !running && !options.running();
      pendingMigration = idle ? undefined : structuredClone(steps);
      const state = scriptToWorkspace(idle ? explicitInputWindows(steps) : steps);
      Blockly.serialization.workspaces.load(state, workspace);
      workspace.clearUndo();
      lastPublished = JSON.stringify(steps);
      warn();
      workspace.scroll(0, 0);
    } catch (error) {
      workspace.clear();
      loadError = "脚本结构无法转换为积木，原数据已保留：" + String(error);
      warn(loadError);
    } finally {
      Blockly.Events.enable();
      loading = false;
    }
    resize();
    components.refresh();
    setRunning(running);
    refreshValidation();
    if (!running && !options.running() && !loadError) flush();
  }
  function insert(step: Step) {
    if (running || options.running() || loadError) return;
    Blockly.Events.setGroup(true);
    try {
      const block = Blockly.serialization.blocks.append(
        encodeNodes([newBlock(step)])!,
        workspace,
        { recordUndo: true },
      ) as ActionBlock;
      const anchor =
        (selected ? workspace.getBlockById(selected) : undefined) ??
        workspace.getBlockById("moligod-start");
      let connection =
        anchor?.type === START_BLOCK
          ? anchor.getInput("BODY")!.connection
          : (anchor?.getInput("BODY_0")?.connection ?? anchor?.nextConnection);
      if (!selected || anchor?.type === START_BLOCK) {
        while (connection?.targetBlock()?.nextConnection)
          connection = connection.targetBlock()!.nextConnection;
      }
      if (connection) {
        const next = connection.targetConnection;
        if (next) connection.disconnect();
        connection.connect(block.previousConnection!);
        if (next) block.nextConnection!.connect(next);
      }
      (block as Blockly.BlockSvg).select();
      selected = block.id;
      publish();
      if (complex.has(step.action.type)) configure(block);
    } catch (error) {
      options.notify(String(error), true);
    } finally {
      Blockly.Events.setGroup(false);
    }
  }
  const created = new Set<string>();
  workspace.addChangeListener((event) => {
    if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT) scheduleSectionLines();
    if (loading) return;
    if (event.type === Blockly.Events.SELECTED)
      selected = (event as Blockly.Events.Selected).newElementId ?? undefined;
    if (event.type === Blockly.Events.BLOCK_CHANGE && (event as Blockly.Events.BlockChange).element === "collapsed") actionSelection.clear();
    if (event.type === Blockly.Events.BLOCK_CREATE && event.recordUndo) {
      const id = (event as Blockly.Events.BlockCreate).blockId;
      if (id) created.add(id);
    }
    if (event.type === Blockly.Events.BLOCK_DELETE) {
      actionSelection.clear();
      (event as Blockly.Events.BlockDelete).ids?.forEach((id) =>
        created.delete(id),
      );
    }
    if (event.type === Blockly.Events.BLOCK_DRAG) {
      const drag = event as Blockly.Events.BlockDrag;
      if (drag.isStart) actionSelection.clear();
      if (!drag.isStart && drag.blockId && created.delete(drag.blockId)) {
        const block = workspace.getBlockById(
          drag.blockId,
        ) as ActionBlock | null;
        if (
          block?.type === ACTION_BLOCK &&
          complex.has(block.readState().step.action.type) &&
          block.getRootBlock().type === START_BLOCK &&
          configured?.id !== block.id
        )
          configure(block);
        if(block?.type===VALUE_BLOCK && (block as unknown as ReporterBlock).payload.kind==="query") queryServices.configure(block as unknown as ReporterBlock);
      }
    }
    if (!event.isUiEvent || event.type === Blockly.Events.BLOCK_DRAG) publish();
  });
  function cancelDrag() {
    actionSelection.clear();
    pickup.cancel();
    const dragger = workspace.getGesture()?.getCurrentDragger();
    if (dragger instanceof ScrollBlockDragger) dragger.stopAutoScrolling();
    workspace.cancelCurrentGesture();
    Blockly.hideChaff();
  }
  const hidden = () => {
    if (document.hidden) cancelDrag();
  };
  window.addEventListener("blur", cancelDrag);
  document.addEventListener("visibilitychange", hidden);
  function setRunning(value: boolean) {
    running = value || taskRunning;
    if (running) {
      components.cancelEdit();
      actionSelection.clear();
      cancelDrag();
    }
    workspace.setIsReadOnly(running);
    for (const block of actions()) {
      renderAnnotation(block, editAnnotation);
      for (const input of block.inputList)
        for (const field of input.fieldRow)
          if (field instanceof CommentField) field.updateEditable();
    }
    controls.setRunning(running);
    host.classList.toggle("auto-blockly-running", running);
    if (!running && !options.running() && !loading && pendingMigration) {
      const steps = pendingMigration;
      pendingMigration = undefined;
      render(steps);
    }
  }
  function ordered(): { step: Step; id: string }[] {
    const result: { step: Step; id: string }[] = [];
    function visit(first: Blockly.Block | null) {
      for (let b = first; b; b = b.getNextBlock()) {
        const block = b as ActionBlock,
          state = block.readState();
        if (state.step.action.type !== "group")
          result.push({ step: state.step, id: block.id });
        state.branches?.forEach((branch) => {
          if (branch.head) result.push({ step: branch.head, id: block.id });
          visit(block.getInputTargetBlock("BODY_" + branch.key));
        });
        if (state.tail) result.push({ step: state.tail, id: block.id });
      }
    }
    visit(
      workspace.getBlockById("moligod-start")?.getInputTargetBlock("BODY") ??
        null,
    );
    return result;
  }
  function highlight(status?: { running: boolean; step: number }) {
    workspace.highlightBlock(
      status?.running ? (ordered()[status.step]?.id ?? null) : null,
    );
    taskRunning = !!status?.running;
    setRunning(options.running());
  }
  function windowBinding(step: Step | undefined, slot: string) {
    let title: string | undefined,
      dynamic = false,
      before = true;
    const context =
      validating?.step === step
        ? validating
        : configured?.step === step
          ? configured
          : undefined;
    for (const row of validationOrder ?? ordered()) {
      if (context && row.id === context.id) before = false;
      if (
        row.step.action.type === "setWindow" &&
        row.step.action.target === slot
      ) {
        dynamic = true;
        if (before) title = String(row.step.action.title ?? "");
      }
    }
    return { title, dynamic };
  }
  function rescale(ratio: number) {
    Blockly.Events.setGroup(true);
    try {
      for(const block of workspace.getAllBlocks(false).filter(b=>b.type===VALUE_BLOCK) as ReporterBlock[]) {
        const value=block.readValue();
        if(value.kind!=="query") continue;
        const before=JSON.stringify({value});scaleAction(value.action,ratio);block.shape(value);block.render();
        Blockly.Events.fire(new Blockly.Events.BlockChange(block,"mutation",null,before,JSON.stringify({value})));
      }
      actions().forEach((block) => {
        const state = block.readState();
        scaleAction(state.step.action, ratio);
        mutate(block, state);
      });
      if (configured) scaleAction(configured.step.action, ratio);
    } finally {
      Blockly.Events.setGroup(false);
    }
  }
  let sectionFrame = 0;
  function scheduleSectionLines() {
    cancelAnimationFrame(sectionFrame);
    sectionFrame = requestAnimationFrame(() => {
      sectionFrame = 0;
      const flyout = host.querySelector<SVGSVGElement>(".blocklyFlyout");
      if (!flyout || !flyout.getClientRects().length) return;
      components.layout();
      const right = flyout.getBoundingClientRect().right - 14;
      for (const label of flyout.querySelectorAll<SVGGElement>(".blocklyFlyoutLabel")) {
        if (label.classList.contains("auto-component-tip")) { label.querySelector(".auto-flow-line")?.remove(); continue; }
        const text = label.querySelector<SVGTextElement>(".blocklyFlyoutLabelText");
        const matrix = label.getScreenCTM();
        if (!text || !matrix) continue;
        const bounds = text.getBBox();
        const x1 = bounds.x + bounds.width + 12;
        const x2 = new DOMPoint(right, label.getBoundingClientRect().top).matrixTransform(matrix.inverse()).x;
        let line = label.querySelector<SVGLineElement>(".auto-flow-line");
        if (!line) {
          line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.classList.add("auto-flow-line");
          line.setAttribute("aria-hidden", "true");
          label.append(line);
        }
        line.setAttribute("x1", String(x1));
        const deleteX = Number(label.dataset.componentDeleteX);
        line.setAttribute("x2", String(Math.max(x1, label.dataset.componentDeleteX ? Math.min(x2, deleteX - 8) : x2)));
        const y = String(bounds.y + bounds.height / 2);
        line.setAttribute("y1", y);
        line.setAttribute("y2", y);
      }
    });
  }
  function resize() {
    if (!host.getClientRects().length) return;
    Blockly.svgResize(workspace);
    scheduleSectionLines();
    if (positionStart) {
      positionStart = false;
      const start = workspace.getBlockById("moligod-start");
      const view = workspace.getMetricsManager().getViewMetrics(true);
      const x = view.left + Math.max(32, Math.min(140, (view.width - 320) / 2));
      if (start) {
        const previous = start.getRelativeToSurfaceXY();
        Blockly.Events.disable();
        try {
          start.moveBy(x - previous.x, 28 - previous.y);
        } finally {
          Blockly.Events.enable();
        }
      }
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const dock = root.closest(".automation-layout")?.querySelector(".auto-toolbox");
  if (dock) observer.observe(dock);
  const flyoutSvg = host.querySelector(".blocklyFlyout");
  if (flyoutSvg) observer.observe(flyoutSvg);
  const toolbox = workspace.getToolbox();
  if (toolbox instanceof Blockly.Toolbox && toolbox.HtmlDiv)
    observer.observe(toolbox.HtmlDiv);
  if (toolbox instanceof Blockly.Toolbox) toolbox.selectItemByPosition(0);
  return {
    render,
    insert,
    flush,
    refreshValidation,
    setRunning,
    highlight,
    windowBinding,
    rescale,
    resize,
    cancelDrag,
    dispose() {
      clearQuerySettings();
      cancelDrag();
      pickup.dispose();
      actionSelection.dispose();
      components.dispose();
      disposeWarningDismissal();
      scrolling.disableWheelScroll();
      window.removeEventListener("blur", cancelDrag);
      document.removeEventListener("visibilitychange", hidden);
      options.beforeRender?.();
      observer.disconnect();
      cancelAnimationFrame(sectionFrame);
      controls.dispose();
      services.delete(workspace);
      const flyoutWorkspace = workspace.getFlyout()?.getWorkspace();
      if (flyoutWorkspace) services.delete(flyoutWorkspace);
      workspace.dispose();
      root.replaceChildren();
    },
  };
}
