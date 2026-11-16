import { desktop, toolboxDock, toolboxDrag, onToolboxWindowError } from "./api";
export function initToolboxShell(failure: (error: unknown) => void) {
  if (!desktop) return;
  void onToolboxWindowError(failure).catch(failure);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let transition = Promise.resolve();
  let dragging = false;
  let moving = false;
  let animating = false;
  const run = (action: () => Promise<unknown>) => {
    transition = transition.then(action).then(() => {}).catch(failure);
  };
  const dock = (collapse: boolean) => {
    if (dragging || animating) return;
    animating = true;
    run(async () => { try { await toolboxDock(collapse); } finally { animating = false; } });
  };
  document.documentElement.addEventListener("mouseleave", () => {
    clearTimeout(timer);
    if (!dragging && !animating) timer = setTimeout(() => dock(true), 350);
  });
  document.documentElement.addEventListener("mouseenter", () => { clearTimeout(timer); dock(false); });
  const header = document.querySelector<HTMLElement>(".app-header")!;
  header.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !document.body.classList.contains("toolbox-compact") ||
        (event.target as HTMLElement).closest("button,input")) return;
    // Bypass native titlebar dragging only for the compact list: no Windows Snap UI.
    event.preventDefault();
    event.stopImmediatePropagation();
    clearTimeout(timer);
    dragging = true;
    header.setPointerCapture(event.pointerId);
    run(() => toolboxDrag("start"));
  }, true);
  header.addEventListener("pointermove", () => {
    if (!dragging || moving) return;
    moving = true;
    run(async () => { try { await toolboxDrag("move"); } finally { moving = false; } });
  });
  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (!dragging) return;
    dragging = false;
    animating = true;
    if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
    run(async () => { try { await toolboxDrag(cancelled ? "cancel" : "end"); } finally { animating = false; } });
  };
  header.addEventListener("pointerup", event => finish(event, false));
  header.addEventListener("pointercancel", event => finish(event, true));
  header.addEventListener("lostpointercapture", event => finish(event, true));
}
