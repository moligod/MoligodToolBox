import { scaleAction } from "./automation-scale.ts";
import type { Step } from "./automation-editor";
export type MousePoint = { x: number; y: number };
/** Pixel under the pointer. Region corners are edges, so `edge` lets them reach width/height
 * and a drag past the bottom-right corner selects the last column and row. */
export function mousePoint(x: number, y: number, rect: {left:number;top:number;width:number;height:number}, width:number, height:number, edge = false): MousePoint {
  const maxX = edge ? width : width - 1, maxY = edge ? height : height - 1;
  return {x: Math.max(0, Math.min(maxX, Math.floor((x - rect.left) * width / rect.width))), y: Math.max(0, Math.min(maxY, Math.floor((y - rect.top) * height / rect.height)))};
}
const regionAction = (step: Step | undefined) => ["ocr", "match", "capture"].includes(step?.action.type ?? "");
export function applyMousePoints(step: Step, start: MousePoint, end: MousePoint) {
  if (["ocr", "match", "capture"].includes(step.action.type)) {
    const width = Math.abs(end.x-start.x), height = Math.abs(end.y-start.y);
    if (!width || !height) return;
    step.action.region = {x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width,height};
  }
  else if (step.action.type === "drag") Object.assign(step.action, {fromX:start.x, fromY:start.y, toX:end.x, toY:end.y});
  else if (["click", "scroll"].includes(step.action.type)) Object.assign(step.action, end);
}
export function createMousePreview(parent: HTMLElement, options: {
  owner: () => Step | undefined;
  scale?: () => number | undefined;
  prepare?: (scale: number) => void;
  locked: () => boolean;
  capture: () => Promise<{width:number;height:number;scale?:number;snapshot?:string;png:string} | undefined>;
  update: () => void;
  /** A new screenshot is being taken; results computed from the old one are stale. */
  invalidate?: () => void;
}) {
  const panel = document.createElement("div");
  panel.className = "mouse-preview";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = "刷新截图";
  const hint = document.createElement("span");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "鼠标操作截图，点击选点或拖动选择起终点");
  panel.append(refresh, hint, canvas);
  parent.insertBefore(panel, parent.querySelector(".auto-composer-submit"));
  let generation = 0, width = 0, height = 0, imageScale = 100;
  let picture: HTMLImageElement | undefined;
  let snapshot: string | undefined;
  let gesture: {id:number; start:MousePoint; owner:Step} | undefined;
  function draw(start?:MousePoint, end?:MousePoint) {
    const ctx = canvas.getContext("2d");
    if (!ctx || !picture) return;
    ctx.drawImage(picture, 0, 0, canvas.width, canvas.height);
    if (["ocr", "match", "capture"].includes(options.owner()?.action.type ?? "")) {
      const a = structuredClone(options.owner()!.action);
      scaleAction(a, imageScale / (options.scale?.() ?? imageScale));
      const regions = [a.region];
      ctx.lineWidth = 2;
      regions.forEach((value) => {
        const r = value as {x:number;y:number;width:number;height:number} | undefined;
        if (!r?.width || !r.height) return;
        ctx.strokeStyle = "#b9ed79";
        ctx.strokeRect(r.x*canvas.width/width,r.y*canvas.height/height,r.width*canvas.width/width,r.height*canvas.height/height);
      });
      if (start && end) {
        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(start.x*canvas.width/width,start.y*canvas.height/height,(end.x-start.x)*canvas.width/width,(end.y-start.y)*canvas.height/height);
      }
      return;
    }
    if (!start || !end) return;
    const sx = canvas.width / width, sy = canvas.height / height;
    ctx.strokeStyle = "#b9ed79";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(start.x*sx, start.y*sy); ctx.lineTo(end.x*sx, end.y*sy); ctx.stroke();
    for (const p of [start,end]) {ctx.beginPath(); ctx.arc(p.x*sx,p.y*sy,5,0,Math.PI*2); ctx.stroke();}
  }
  function reset() {generation++; picture = undefined; snapshot = undefined; gesture = undefined; canvas.hidden = true; panel.hidden = true; refresh.disabled = false;}
  function updateMode() {
    gesture = undefined;
    const owner = options.owner();
    if (owner?.action.type === "click" && owner.action.position !== undefined) {panel.hidden = true; return;}
    if (!owner || !picture) return;
    panel.hidden = false;
      const a = structuredClone(owner.action);
      const source = options.scale?.();
      if (source) scaleAction(a, imageScale / source);
      const start = {x:Number(a.type === "drag" ? a.fromX : a.x),y:Number(a.type === "drag" ? a.fromY : a.y)};
      const end = a.type === "drag" ? {x:Number(a.toX),y:Number(a.toY)} : start;
      if (start.x >= 0 && start.y >= 0 && end.x >= 0 && end.y >= 0) draw(start,end);
      else draw();
      hint.textContent = "";
      hint.hidden = true;
  }
  async function load() {
    reset();
    options.invalidate?.();
    const owner = options.owner();
    if (owner?.action.type === "click" && owner.action.position !== undefined) return;
    if (!owner || !["click","drag","scroll","ocr","match","capture"].includes(owner.action.type)) return;
    canvas.setAttribute("aria-label", ["ocr","match","capture"].includes(owner.action.type) ? "窗口截图，拖动框选操作区域" : "鼠标操作截图，点击选点或拖动选择起终点");
    panel.hidden = false;
    const token = generation;
    hint.hidden = false;
    hint.textContent = "正在加载截图…";
    refresh.disabled = true;
    try {
      const result = await options.capture();
      if (generation !== token || options.owner() !== owner) return;
      if (!result) {hint.textContent = "请先选择目标窗口"; return;}
      const image = new Image(); image.src = "data:image/png;base64," + result.png;
      await image.decode();
      if (generation !== token || options.owner() !== owner) return;
      options.prepare?.(result.scale!);
      imageScale = result.scale ?? 100;
      width = result.width; height = result.height; picture = image;
      snapshot = result.snapshot;
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.hidden = false;
      updateMode();
    } catch (error) {if (generation === token) hint.textContent = "截图失败：" + String(error);}
    finally {if (generation === token) refresh.disabled = false;}
  }
  const point = (e:PointerEvent, owner:Step) => mousePoint(e.clientX,e.clientY,canvas.getBoundingClientRect(),width,height,regionAction(owner));
  canvas.addEventListener("pointerdown", e => {
    const owner = options.owner();
    if (e.button !== 0 || !picture || !owner || options.locked()) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    gesture = {id:e.pointerId,start:point(e,owner),owner};
  });
  canvas.addEventListener("pointermove", e => {if (gesture?.id === e.pointerId) draw(gesture.start,point(e,gesture.owner));});
  canvas.addEventListener("pointerup", e => {
    const current = gesture; gesture = undefined;
    if (!current || current.id !== e.pointerId || current.owner !== options.owner() || options.locked()) return;
    const end = point(e,current.owner);
    const source = options.scale?.() ?? imageScale;
    const convert = (p:MousePoint) => ({x:Math.round(p.x*source/imageScale),y:Math.round(p.y*source/imageScale)});
    const startPoint = convert(current.start), endPoint = convert(end);
    applyMousePoints(current.owner,startPoint,endPoint);
    options.update();
    draw(current.owner.action.type === "drag" ? current.start : end,end);
    hint.textContent = "";
    hint.hidden = true;
  });
  canvas.addEventListener("pointercancel", () => {gesture = undefined; draw();});
  canvas.addEventListener("lostpointercapture", () => {gesture = undefined;});
  refresh.addEventListener("click", () => {if (!options.locked()) void load();});
  reset();
  function selection() {
    const owner = options.owner();
    if (!picture || !snapshot || !owner) throw new Error("请刷新截图后再测试识别");
    const action = structuredClone(owner.action);
    scaleAction(action, imageScale / (options.scale?.() ?? imageScale));
    const region = action.region as {x:number;y:number;width:number;height:number} | undefined;
    if (!region || ![region.x,region.y,region.width,region.height].every(Number.isFinite) || region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0)
      throw new Error("请先框选有效的识别区域");
    return {snapshot, region};
  }
  return {load,reset,updateMode,refresh,selection,current: () => snapshot};
}
