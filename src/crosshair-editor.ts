import { showPage } from "./navigation";
import {
  desktop,
  crosshairAction,
  crosshairMonitors,
  importCrosshairImage,
  crosshairImagePreview,
  onCrosshairState,
  type CrosshairStatus,
  type Config,
  type Crosshair,
  type ModuleInfo,
} from "./api";
import type { CrosshairStyle } from "./crosshair-model";
import { decodePngPreview } from "./image-preview";
import { latestUpdate } from "./latest-update";
import { bindOffsetControls } from "./offset-controls";
import { bindHotkeyCapture } from "./hotkey-capture";
import {
  createCrosshairCode,
  readCrosshairCode,
  IMAGE_CODE_UNSUPPORTED,
} from "./crosshair-code";

export function initCrosshairEditor(options: {
  getConfig: () => Config | undefined;
  save: (crosshair: Crosshair) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const get = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const input = (id: string) => get<HTMLInputElement>(id);
  const dialog = get<HTMLElement>("crosshair-dialog");
  const canvas = get<HTMLCanvasElement>("crosshair-preview");
  const ctx = canvas.getContext("2d")!;
  let imageId: string | null = null;
  let image: HTMLImageElement | undefined;
  let imageUrl: string | undefined;
  let imageRequest = 0;
  let busy = false;
  let state: CrosshairStatus = {
    running: false,
    visible: false,
    error: null,
    drawCount: 0,
  };
  let unlisten: (() => void) | undefined;
  let disposed = false;
  let generation = 0;
  let initialized = false;
  let releaseTransition: Promise<unknown> = Promise.resolve();
  let recordingKey = false;
  let installed = !desktop;
  let installationError = "准星模块未安装";
  let captureTransition: Promise<void> = Promise.resolve();
  const disposeOffsets = bindOffsetControls(dialog, changed);
  const updates = latestUpdate<Crosshair>(
    async (value) => {
      if (!state.running) return;
      setStatus(await crosshairAction("apply", value));
    },
    (error) => options.notify(String(error), true),
  );

  function changed() {
    draw();
    if (!get<HTMLFormElement>("crosshair-form").checkValidity()) return;
    const value = draft();
    get("dialog-notice").hidden = true;
    options.save(value);
    if (!desktop || !state.running) return;
    if (value.style === "image" && !value.imageId) return;
    updates.push(value);
  }

  function draft(): Crosshair {
    return {
      size: +input("aim-size").value,
      thickness: +input("aim-thickness").value,
      gap: +input("aim-gap").value,
      color: input("aim-color").value,
      style: input("aim-style").value as CrosshairStyle,
      dotSize: +input("aim-dot").value,
      opacity: +input("aim-opacity").value,
      monitor: input("aim-monitor").value,
      offsetX: +input("aim-x").value,
      offsetY: +input("aim-y").value,
      hotkey: input("aim-hotkey").value ? +input("aim-hotkey").value : null,
      hotkeyMode: input("aim-hotkey-mode").value as Crosshair["hotkeyMode"],
      imageId,
      imageScale: +input("aim-image-scale").value,
    };
  }
  function controls() {
    get<HTMLButtonElement>("start-crosshair").disabled =
      !desktop || !installed || busy || recordingKey || !options.getConfig();
    get<HTMLButtonElement>("choose-crosshair-image").disabled =
      !desktop || !installed || busy;
    get<HTMLButtonElement>("start-crosshair").textContent = state.running
      ? "关闭自定义准星"
      : "开启自定义准星";
    get("crosshair-card-state").textContent =
      desktop && !installed
        ? "未安装"
        : state.running
          ? state.visible
            ? "运行中"
            : "已隐藏"
          : "未开启";
  }
  function setStatus(next: CrosshairStatus) {
    state = next;
    if (!state.running) {
      void updates.pause();
      updates.clear();
    } else if (!busy && !recordingKey) updates.resume();
    controls();
    if (next.error) options.notify(next.error, true);
  }
  async function action(
    kind: "start" | "stop" | "show" | "hide" | "apply",
    config?: Crosshair,
  ) {
    if (busy) return false;
    busy = true;
    controls();
    try {
      await updates.pause();
      if (kind === "stop") updates.clear();
      get("dialog-notice").hidden = true;
      setStatus(await crosshairAction(kind, config));
      if (
        kind === "start" &&
        !dialog.hidden &&
        get<HTMLFormElement>("crosshair-form").checkValidity()
      )
        updates.push(draft());
      return true;
    } catch (error) {
      options.notify(String(error), true);
      return false;
    } finally {
      busy = false;
      if (state.running && !recordingKey) updates.resume();
      controls();
    }
  }
  function draw() {
    const c = draft();
    for (const [field, value] of [
      ["size", c.size],
      ["thickness", c.thickness],
      ["gap", c.gap],
      ["dot", c.dotSize],

      ["image-scale", c.imageScale],
    ]) {
      get(field + "-output").textContent = String(value);
    }
    const isImage = c.style === "image";
    get("image-controls").hidden = !isImage;
    get("shape-controls").hidden = isImage;
    get("color-field").hidden = isImage;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const x = canvas.width / 2,
      y = canvas.height / 2;
    ctx.globalAlpha = c.opacity / 100;
    ctx.strokeStyle = c.color;
    ctx.fillStyle = c.color;
    ctx.lineWidth = c.thickness;
    if (isImage) {
      if (image) {
        const width = (image.width * c.imageScale) / 100,
          height = (image.height * c.imageScale) / 100;
        const fit = Math.min(
          1,
          (canvas.width - 12) / width,
          (canvas.height - 12) / height,
        );
        ctx.drawImage(
          image,
          x - (width * fit) / 2,
          y - (height * fit) / 2,
          width * fit,
          height * fit,
        );
      }
    } else {
      if (c.style === "cross") {
        const r = c.size / 2,
          gap = c.gap / 2;
        ctx.beginPath();
        ctx.moveTo(x - gap - r, y);
        ctx.lineTo(x - gap, y);
        ctx.moveTo(x + gap, y);
        ctx.lineTo(x + gap + r, y);
        ctx.moveTo(x, y - gap - r);
        ctx.lineTo(x, y - gap);
        ctx.moveTo(x, y + gap);
        ctx.lineTo(x, y + gap + r);
        ctx.stroke();
      }
      if (c.style === "dot") {
        ctx.beginPath();
        ctx.arc(x, y, c.dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (c.style === "circle") {
        ctx.beginPath();
        ctx.arc(x, y, c.size / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  function clearImage() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = undefined;
    image = undefined;
  }
  async function loadImage(id: string | null) {
    const request = ++imageRequest;
    clearImage();
    if (!id || !desktop) {
      draw();
      return;
    }
    try {
      const bytes = await crosshairImagePreview(id);
      if (request !== imageRequest || dialog.hidden) return;
      const { image: loaded, url } = await decodePngPreview(bytes);
      if (request !== imageRequest || dialog.hidden) {
        URL.revokeObjectURL(url);
        return;
      }
      imageUrl = url;
      image = loaded;
      draw();
    } catch (error) {
      if (request === imageRequest) options.notify(String(error), true);
    }
  }
  async function fillMonitors(id: string) {
    const currentGeneration = generation;
    const select = get<HTMLSelectElement>("aim-monitor");
    select.replaceChildren(new Option("主显示器（自动）", ""));
    if (id) select.add(new Option(id, id));
    select.value = id;
    if (!desktop) return;
    try {
      const monitors = await crosshairMonitors();
      if (
        dialog.hidden ||
        currentGeneration !== generation ||
        select.value !== id
      )
        return;
      select.replaceChildren(new Option("主显示器（自动）", ""));
      monitors.forEach((m, i) =>
        select.add(
          new Option(
            `显示器 ${i + 1} · ${m.width}×${m.height}${m.primary ? " · 主屏" : ""}`,
            m.id,
          ),
        ),
      );
      if (id && !monitors.some((m) => m.id === id))
        select.add(new Option("已断开显示器（回退主屏）", id));
      select.value = id;
    } catch (error) {
      options.notify(String(error), true);
    }
  }

  get("open-crosshair").addEventListener("click", () => showPage("crosshair"));
  dialog.addEventListener("activate", () => {
    const config = options.getConfig();
    if (!config) return;
    if (!initialized) generation++;
    const currentGeneration = generation;
    const c = initialized ? draft() : config.crosshair;
    if (!initialized) {
      for (const [name, value] of Object.entries({
        size: c.size,
        thickness: c.thickness,
        gap: c.gap,
        color: c.color,
        style: c.style,
        dot: c.dotSize,
        opacity: c.opacity,
        x: c.offsetX,
        y: c.offsetY,
        hotkey: c.hotkey ?? "",
        "hotkey-mode": c.hotkeyMode,
        "image-scale": c.imageScale,
      })) {
        input("aim-" + name).value = String(value);
      }
      imageId = c.imageId;
      hotkeyCapture.refresh();
      clearImage();
      initialized = true;
    }
    get("dialog-notice").hidden = true;
    draw();
    controls();
    if (desktop && installed) {
      void releaseTransition
        .then(() => {
          if (!initialized || generation !== currentGeneration) return;
          return crosshairAction("open");
        })
        .then(() => {
          if (dialog.hidden || !initialized || generation !== currentGeneration)
            return;
          void fillMonitors(c.monitor);
          if (!image) void loadImage(imageId);
        })
        .catch((error) => {
          if (initialized && generation === currentGeneration)
            options.notify(String(error), true);
        });
    } else if (!desktop) {
      void fillMonitors(c.monitor);
      void loadImage(imageId);
    } else {
      options.notify(installationError, true);
    }
  });
  dialog.querySelectorAll("input,select").forEach((control) => {
    if (!["aim-code", "crosshair-image-file"].includes(control.id))
      control.addEventListener("input", changed);
  });
  get("start-crosshair").addEventListener("click", () => {
    if (state.running) {
      void action("stop");
      return;
    }
    if (get<HTMLFormElement>("crosshair-form").reportValidity())
      void action("start", draft());
  });
  get("center-crosshair").addEventListener("click", () => {
    input("aim-x").value = "0";
    input("aim-y").value = "0";
    changed();
  });
  canvas.addEventListener("keydown", (event) => {
    const offsets: Record<string, [string, number]> = {
      ArrowLeft: ["aim-x", -1],
      ArrowRight: ["aim-x", 1],
      ArrowUp: ["aim-y", -1],
      ArrowDown: ["aim-y", 1],
    };
    if (!offsets[event.key]) return;
    event.preventDefault();
    const [field, delta] = offsets[event.key];
    input(field).value = String(
      Math.max(
        -16384,
        Math.min(
          16384,
          +input(field).value + delta * (event.shiftKey ? 10 : 1),
        ),
      ),
    );
    changed();
  });
  get("choose-crosshair-image").addEventListener("click", () =>
    input("crosshair-image-file").click(),
  );
  input("crosshair-image-file").addEventListener("change", () => {
    void (async () => {
      const file = input("crosshair-image-file").files?.[0];
      if (!file) return;
      const currentGeneration = generation;
      busy = true;
      controls();
      try {
        if (file.size > 8 * 1024 * 1024) throw new Error("图片不能超过 8 MiB");
        const id = await importCrosshairImage(
          Array.from(new Uint8Array(await file.arrayBuffer())),
        );
        if (!initialized || currentGeneration !== generation) return;
        imageId = id;
        input("aim-style").value = "image";
        input("aim-image-scale").value = "100";
        await loadImage(id);
        changed();
      } catch (error) {
        options.notify(String(error), true);
      } finally {
        busy = false;
        if (state.running && !recordingKey) updates.resume();
        controls();
        input("crosshair-image-file").value = "";
      }
    })();
  });
  get("crosshair-form").addEventListener("submit", (event) => {
    event.preventDefault();
  });
  const codeInput = get<HTMLInputElement>("aim-code");
  const codeStatus = get("aim-code-status");
  get("generate-aim-code").addEventListener("click", () => {
    if (input("aim-style").value === "image") {
      codeInput.value = IMAGE_CODE_UNSUPPORTED;
      codeStatus.textContent = "";
      return;
    }
    if (!get<HTMLFormElement>("crosshair-form").reportValidity()) return;
    try {
      codeInput.value = createCrosshairCode(draft());
      codeStatus.textContent = "";
    } catch (error) {
      options.notify(String(error), true);
    }
  });
  get("copy-aim-code").addEventListener("click", () => {
    void (async () => {
      if (codeInput.value === IMAGE_CODE_UNSUPPORTED) return;
      if (!codeInput.value.trim()) {
        codeStatus.textContent = "请先生成或输入准星码。";
        return;
      }
      try {
        await navigator.clipboard.writeText(codeInput.value.trim());
        codeStatus.textContent = "准星码已复制。";
      } catch {
        codeInput.focus();
        codeInput.select();
        codeStatus.textContent = "已选中准星码，请按 Ctrl+C 复制。";
      }
    })();
  });
  codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      get("load-aim-code").click();
    }
  });
  get("load-aim-code").addEventListener("click", () => {
    if (busy || recordingKey) return;
    try {
      const c = readCrosshairCode(codeInput.value, draft());
      for (const [name, value] of Object.entries({
        style: c.style,
        size: c.size,
        thickness: c.thickness,
        gap: c.gap,
        dot: c.dotSize,
        opacity: c.opacity,
        color: c.color,
        "image-scale": c.imageScale,
      }))
        input("aim-" + name).value = String(value);
      if (c.style === "image") {
        imageId = null;
        imageRequest++;
        clearImage();
      }
      get("dialog-notice").hidden = true;
      changed();
      codeStatus.textContent =
        c.style === "image"
          ? "图片样式参数已载入，请选择自己的准星图片。"
          : "准星码已载入。";
    } catch (error) {
      options.notify(String(error), true);
    }
  });
  dialog.addEventListener("close", () => {
    initialized = false;
    generation++;
    imageRequest++;
    clearImage();
    if (desktop)
      releaseTransition = crosshairAction("release").catch((error) =>
        options.notify(String(error), true),
      );
  });
  const hotkeyCapture = bindHotkeyCapture(dialog, {
    changed,
    error: (error) => options.notify(String(error), true),
    suspend: async (active) => {
      recordingKey = active;
      controls();
      const transition = captureTransition.then(async () => {
        if (active) await updates.pause();
        if (desktop)
          setStatus(
            await crosshairAction(active ? "capture-on" : "capture-off"),
          );
      });
      captureTransition = transition.catch(() => {});
      try {
        await transition;
      } finally {
        if (!recordingKey && state.running) updates.resume();
      }
    },
  });
  if (desktop) {
    void onCrosshairState(setStatus)
      .then((stop) => {
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
        void crosshairAction("status")
          .then(setStatus)
          .catch((error) => options.notify(String(error), true));
      })
      .catch((error) => options.notify(String(error), true));
  }
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      disposeOffsets();
      hotkeyCapture.dispose();
      void updates.pause();
      updates.clear();
      unlisten?.();
      clearImage();
    },
    { once: true },
  );
  return {
    setInstalled(info: ModuleInfo | undefined) {
      installed = Boolean(info?.installed);
      installationError = info?.error ?? "准星模块未安装";
      controls();
    },
    setStatus,
    refresh: controls,
  };
}
