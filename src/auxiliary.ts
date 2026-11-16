import {
  desktop,
  auxiliaryState,
  onAuxiliaryState,
  submitAuxiliary,
  controlWindow,
  type AuxiliaryState,
  type AuxiliaryMode,
  type SelectionEvent,
} from "./api";
import { imagePoint, imageRegion, type ImagePoint } from "./image-region";
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const stage = get("aux-image-stage"),
  image = get<HTMLImageElement>("aux-image"),
  box = get("aux-selection"),
  confirm = get<HTMLButtonElement>("aux-confirm");
let mode: AuxiliaryMode,
  state: AuxiliaryState,
  start: ImagePoint | null = null,
  selection: SelectionEvent["selection"] | null = null,
  revision = 0,
  disposed = false;
function status(text: string, error = false) {
  get("aux-status").textContent = text;
  get("aux-status").classList.toggle("error", error);
}
export async function renderAuxiliary(next: AuxiliaryState) {
  if (
    state?.state !== "loading" &&
    state?.token === next.token &&
    next.state === "loading"
  )
    return;
  state = next;
  mode = next.mode;
  resetSelection();
  const own = ++revision;
  get("aux-title").textContent =
    next.mode === "ocr"
      ? "OCR 识别结果"
      : "截图选区";
  get("aux-window-title").textContent = get("aux-title").textContent;
  get("aux-ocr").hidden = true;
  get("aux-image-panel").hidden = true;
  if (next.state === "loading") {
    status(
      next.mode === "ocr"
        ? "正在识别指定区域…"
        : "正在截取目标窗口…",
    );
    return;
  }
  if (next.state === "error") {
    status(next.error ?? "操作失败", true);
    return;
  }
  if (next.mode === "ocr") {
    const text = next.result?.text ?? "";
    get<HTMLTextAreaElement>("aux-text").value = text;
    get("aux-ocr").hidden = false;
    status(text ? "识别完成，可选择或复制下方文字。" : "该区域未识别到文字。");
    return;
  }
  try {
    image.src = "data:image/png;base64," + next.result!.png;
    await image.decode();
    if (own !== revision || disposed) return;
    get("aux-image-panel").hidden = false;
    selectionHint();
  } catch (error) {
    status(String(error), true);
  }
}
function resetSelection() {
  start = null;
  selection = null;
  box.hidden = true;
  confirm.disabled = true;
  confirm.textContent = mode === "point" ? "使用坐标" : "使用选区";
  get("aux-coordinates").textContent =
    "请选择区域";
}
function selectionHint() {
  status(
    mode === "point"
      ? "点击图片选择坐标，再确认。"
      : "按住左键拖出矩形，确认后将选区填回主窗口。",
  );
}
function point(event: PointerEvent) {
  const rect = image.getBoundingClientRect();
  return imagePoint(
    event.clientX - rect.left,
    event.clientY - rect.top,
    rect.width,
    rect.height,
    state.result!.width!,
    state.result!.height!,
  );
}
function draw(end: ImagePoint) {
  if (!start) return;
  const r = imageRegion(start, end);
  box.hidden = !r;
  confirm.disabled = !r;
  selection = r;
  if (!r) return;
  Object.assign(box.style, {
    left: (r.x / state.result!.width!) * 100 + "%",
    top: (r.y / state.result!.height!) * 100 + "%",
    width: (r.width! / state.result!.width!) * 100 + "%",
    height: (r.height! / state.result!.height!) * 100 + "%",
  });
  get("aux-coordinates").textContent =
    `左上 (${r.x}, ${r.y}) → 右下 (${r.x + r.width!}, ${r.y + r.height!}) · ${r.width} × ${r.height}`;
}
stage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || state.state !== "ready") return;
  event.preventDefault();
  if (mode === "point") {
    const p = point(event);
    selection = {
      x: Math.min(p.x, state.result!.width! - 1),
      y: Math.min(p.y, state.result!.height! - 1),
    };
    confirm.disabled = false;
    confirm.textContent = "使用坐标";
    get("aux-coordinates").textContent =
      `坐标 (${selection.x}, ${selection.y})`;
    return;
  }
  selection = null;
  box.hidden = true;
  confirm.disabled = true;
  start = point(event);
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener("pointermove", (event) => {
  if (start) draw(point(event));
});
stage.addEventListener("pointerup", (event) => {
  if (!start) return;
  draw(point(event));
  start = null;
  if (stage.hasPointerCapture(event.pointerId))
    stage.releasePointerCapture(event.pointerId);
});
for (const type of ["pointercancel", "lostpointercapture"])
  stage.addEventListener(type, () => {
    if (start) {
      start = null;
      selection = null;
      box.hidden = true;
      confirm.disabled = true;
    }
  });
confirm.addEventListener("click", () => {
  if (selection)
    void submitAuxiliary(selection, mode).catch((error) =>
      status(String(error), true),
    );
});
for (const action of ["close", "minimize", "maximize"] as const)
  get("aux-" + action).addEventListener("click", () => {
    if (desktop)
      void controlWindow(action).catch((error) => status(String(error), true));
  });
get("aux-copy").addEventListener(
  "click",
  () =>
    void navigator.clipboard
      .writeText(get<HTMLTextAreaElement>("aux-text").value)
      .then(() => status("已复制。"))
      .catch((error) => status(String(error), true)),
);
let stop: (() => void) | undefined;
if (desktop)
  void onAuxiliaryState((value) => void renderAuxiliary(value))
    .then(async (dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      stop = dispose;
      await renderAuxiliary(await auxiliaryState());
    })
    .catch((error) => status(String(error), true));
else status("此页面由桌面客户端打开，截图与OCR结果将在独立窗口中显示。");
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    stop?.();
  },
  { once: true },
);

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (start) {
    start = null;
    selection = null;
    box.hidden = true;
    confirm.disabled = true;
  } else if (desktop)
    void controlWindow("close").catch((error) => status(String(error), true));
});
