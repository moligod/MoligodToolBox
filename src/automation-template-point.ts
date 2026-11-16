import { imagePoint, type ImagePoint } from "./image-region.ts";

export function templateImagePoint(
  x: number,
  y: number,
  displayWidth: number,
  displayHeight: number,
  width: number,
  height: number,
): ImagePoint {
  const point = imagePoint(x, y, displayWidth, displayHeight, width, height);
  return { x: Math.min(width - 1, point.x), y: Math.min(height - 1, point.y) };
}

export function createTemplatePointPicker(parent: HTMLElement) {
  const dialog = document.createElement("dialog");
  dialog.className = "template-point-dialog";
  dialog.setAttribute("aria-label", "选择保存位置");
  dialog.innerHTML =
    '<h3>选择保存位置</h3><p>在模板图片上点击要保存的点，也可用方向键微调。</p><canvas tabindex="0" aria-label="模板图片选点"></canvas><p class="template-point-status" aria-live="polite"></p><div class="actions"><button type="button" data-use>使用此位置</button><button type="button" class="secondary" data-cancel>取消</button></div>';
  parent.append(dialog);
  const canvas = dialog.querySelector("canvas")!;
  const context = canvas.getContext("2d")!;
  const status = dialog.querySelector(".template-point-status")!;
  let image: HTMLImageElement | undefined;
  let selected: ImagePoint = { x: 0, y: 0 };
  let generation = 0;
  let commit: ((point: ImagePoint) => void) | undefined;
  function draw() {
    if (!image) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    context.strokeStyle = "#ff4545";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(selected.x - 8, selected.y);
    context.lineTo(selected.x + 8, selected.y);
    context.moveTo(selected.x, selected.y - 8);
    context.lineTo(selected.x, selected.y + 8);
    context.stroke();
    status.textContent = `保存位置 (${selected.x}, ${selected.y}) · 图片 ${canvas.width} × ${canvas.height}`;
  }
  function close() {
    generation++;
    commit = undefined;
    image = undefined;
    dialog.close();
  }
  canvas.addEventListener("click", (event) => {
    const bounds = canvas.getBoundingClientRect();
    selected = templateImagePoint(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      bounds.width,
      bounds.height,
      canvas.width,
      canvas.height,
    );
    draw();
  });
  canvas.addEventListener("keydown", (event) => {
    const moves: Record<string, ImagePoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    selected = {
      x: Math.max(0, Math.min(canvas.width - 1, selected.x + move.x)),
      y: Math.max(0, Math.min(canvas.height - 1, selected.y + move.y)),
    };
    draw();
  });
  dialog.querySelector("[data-cancel]")!.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.querySelector("[data-use]")!.addEventListener("click", () => {
    const save = commit;
    const point = { ...selected };
    close();
    save?.(point);
  });
  return {
    close,
    async open(
      png: string,
      point: ImagePoint | undefined,
      save: (point: ImagePoint) => void,
    ) {
      close();
      const token = generation;
      const source = new Image();
      source.src = `data:image/png;base64,${png}`;
      await source.decode();
      if (token !== generation) return;
      image = source;
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      selected = point ?? {
        x: Math.floor(canvas.width / 2),
        y: Math.floor(canvas.height / 2),
      };
      if (
        !Number.isInteger(selected.x) ||
        !Number.isInteger(selected.y) ||
        selected.x < 0 ||
        selected.y < 0 ||
        selected.x >= canvas.width ||
        selected.y >= canvas.height
      )
        throw new Error("保存位置超出模板图片，请重新选择图片");
      commit = save;
      draw();
      dialog.showModal();
      canvas.focus();
    },
  };
}
