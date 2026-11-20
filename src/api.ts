import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { defaultCrosshair, type Crosshair } from "./crosshair-model";
import { decodeLibrary, type GameLibrary } from "./game-library-model";
export type { Crosshair } from "./crosshair-model";

export interface CrosshairStatus {
  running: boolean;
  visible: boolean;
  error: string | null;
  drawCount: number;
}
export interface Monitor {
  id: string;
  primary: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Config {
  schemaVersion: number;
  closeToTray: boolean;
  crosshair: Crosshair;
}
export interface Bootstrap {
  version: string;
  config: Config;
  crosshairStatus: CrosshairStatus;
  modules: ModuleInfo[];
}
export interface ModuleInfo {
  id: string;
  installed: boolean;
  version: string | null;
  source: string;
  processId: number | null;
  error: string | null;
}
export interface AutomationStatus {
  notice?: string | null;
  running: boolean;
  phase: string;
  step: number;
  executed: number;
  error: string | null;
  variables: Record<string, unknown>;
  logs: string[];
  revision?: number;
}
export interface BoundWindow {
  hwnd: number;
  pid: number;
  title: string;
  width: number;
  height: number;
}
export const automationAction = <T = unknown>(
  action: string,
  payload: unknown = null,
): Promise<T> => invoke("automation_action", { action, payload });
export const onAutomationState = (
  callback: (status: AutomationStatus) => void,
) =>
  listen<AutomationStatus>("automation-state", (event) =>
    callback(event.payload),
  );
export const desktop = isTauri();
export interface OfficialComponent {
  id: string;
  name: string;
  description: string;
}
export interface OfficialCatalog {
  schemaVersion: number;
  components: OfficialComponent[];
}
export interface AppRelease {
  version: string;
  tag: string;
  notes: string;
}
export const officialComponentCatalog = (): Promise<OfficialCatalog> => invoke("official_component_catalog");
export const officialComponentCode = (id: string): Promise<string> => invoke("official_component_code", { id });
export const checkAppUpdate = (): Promise<AppRelease | null> => invoke("check_app_update");
export const installAppUpdate = (version: string): Promise<void> => invoke("install_app_update", { version });
export async function loadGameLibrary(): Promise<GameLibrary> {
  if (desktop) return decodeLibrary(await invoke("load_game_library"));
  return (await import("./game-library-browser")).browserGameLibrary();
}
export async function saveGameLibrary(library: GameLibrary): Promise<GameLibrary> {
  decodeLibrary(library);
  if (desktop) return decodeLibrary(await invoke("save_game_library", { library }));
  return (await import("./game-library-browser")).browserGameLibrary(library);
}
export const crosshairAction = (
  action:
    | "start"
    | "stop"
    | "apply"
    | "show"
    | "hide"
    | "status"
    | "capture-on"
    | "capture-off"
    | "open"
    | "release",
  config?: Crosshair,
): Promise<CrosshairStatus> =>
  invoke("crosshair_action", { action, config: config ?? null });
export const crosshairMonitors = (): Promise<Monitor[]> =>
  invoke("crosshair_monitors");
export const importCrosshairImage = (bytes: number[]): Promise<string> =>
  invoke("import_crosshair_image", { bytes });
export const crosshairImagePreview = (imageId: string): Promise<number[]> =>
  invoke("crosshair_image_preview", { imageId });
export const onCrosshairState = (callback: (status: CrosshairStatus) => void) =>
  listen<CrosshairStatus>("crosshair-state", (event) =>
    callback(event.payload),
  );
export const openDeltaGuide = (): Promise<void> => invoke("open_delta_guide");
export type WindowAction = "minimize" | "maximize" | "close";
export const startWindowDrag = () => getCurrentWindow().startDragging();
export async function controlWindow(action: WindowAction): Promise<void> {
  if (!desktop) throw new Error("窗口操作仅在桌面客户端可用。");
  const window = getCurrentWindow();
  if (action === "minimize") await window.minimize();
  else if (action === "maximize") await window.toggleMaximize();
  else await window.close();
}
export const previewConfig: Config = {
  schemaVersion: 3,
  closeToTray: false,
  crosshair: { ...defaultCrosshair },
};

export const load = (): Promise<Bootstrap> =>
  desktop
    ? invoke("bootstrap")
    : Promise.resolve({
        version: "0.1.0",
        config: structuredClone(previewConfig),
        crosshairStatus: {
          running: false,
          visible: false,
          error: null,
          drawCount: 0,
        },
        modules: [],
      });

export async function save(config: Config): Promise<Config> {
  if (!desktop) throw new Error("浏览器仅供界面预览，请在桌面客户端保存配置。");
  return invoke("save_config", { config });
}

export type AuxiliaryMode =
  "point" | "region" | "ocr";
export interface AuxiliaryState {
  state: "loading" | "ready" | "error";
  mode: AuxiliaryMode;
  token: number;
  error?: string;
  result?: {
    png?: string;
    width?: number;
    height?: number;
    text?: string;
  };
}
export interface SelectionEvent {
  token: number;
  mode: AuxiliaryMode;
  selection: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
}
export const openAuxiliary = (
  mode: AuxiliaryMode,
  token: number,
  payload: unknown,
): Promise<void> => invoke("open_auxiliary", { mode, token, payload });
export const closeAuxiliary = (): Promise<void> => invoke("close_auxiliary");
export const auxiliaryState = (): Promise<AuxiliaryState> =>
  invoke("auxiliary_state");
export const onAuxiliaryState = (callback: (state: AuxiliaryState) => void) =>
  listen<AuxiliaryState>("auxiliary-state", (event) => callback(event.payload));
export const submitAuxiliary = (
  selection: SelectionEvent["selection"],
  mode: AuxiliaryMode,
): Promise<void> => invoke("submit_auxiliary", { selection, mode });
export const onAutomationSelection = (
  callback: (event: SelectionEvent) => void,
) =>
  listen<SelectionEvent>("automation-selection", (event) =>
    callback(event.payload),
  );

export const onAutomationTaskState = (
  callback: (value: { taskId: string; status: AutomationStatus }) => void,
) =>
  listen<{ taskId: string; status: AutomationStatus }>(
    "automation-task-state",
    (event) => callback(event.payload),
  );

export const chooseCaptureDirectory = (): Promise<string | null> => invoke("choose_capture_directory");
export interface AutomationBarSnapshot {
  revision: number;
  maxWidth: number;
  rows: Array<AutomationStatus & {taskName:string; round:number; totalSteps:number; ocrModel:string; ocrDevice:string; stopHotkey:string}>;
}
export const automationBarState = (): Promise<AutomationBarSnapshot> => invoke("automation_bar_state");
export const resizeAutomationBar = (revision: number, width: number, height: number): Promise<boolean> => invoke("resize_automation_bar", {revision, width, height});
export const dismissAutomationBar = (revision: number): Promise<void> => invoke("dismiss_automation_bar", {revision});
export const onAutomationBarState = (callback: (snapshot: AutomationBarSnapshot) => void) => listen<AutomationBarSnapshot>("automation-bar-state", event => callback(event.payload));

export const setToolboxExpanded = (expanded: boolean): Promise<void> => desktop ? invoke("set_toolbox_expanded", { expanded }) : Promise.resolve();
export const toolboxDock = (collapse: boolean): Promise<boolean> => invoke("toolbox_dock", { collapse });
export const onWindowMoved = (callback: () => void) => getCurrentWindow().onMoved(callback);

export const onToolboxRestored = (callback: () => void) => listen("toolbox-restored", callback);

export const toolboxDrag = (phase: "start" | "move" | "end" | "cancel"): Promise<boolean> => invoke("toolbox_drag", { phase });

export const onToolboxWindowError = (callback: (error: string) => void) => listen<string>("toolbox-window-error", event => callback(event.payload));

export const toolWindowPage = desktop
  ? ({ "tool-crosshair": "crosshair", "tool-automation": "automation" } as Record<string, string>)[getCurrentWindow().label]
  : new URLSearchParams(location.search).get("tool") ?? undefined;
/** The host hid this tool window (title-bar close) or showed it again. */
export const onToolWindowVisibility = (callback: (visible: boolean) => void) =>
  listen<{ label: string; visible: boolean }>("tool-window-visibility", (event) => {
    if (event.payload.label === getCurrentWindow().label) callback(event.payload.visible);
  });
export async function openToolWindow(tool: string): Promise<void> {
  if (desktop) return invoke("open_tool_window", { tool });
  window.open(`/index.html?tool=${encodeURIComponent(tool)}`, `moligod-${tool}`);
}

export const openWebsite = (site: string): Promise<void> => invoke("open_website", { site });
