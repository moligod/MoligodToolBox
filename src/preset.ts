import type { Crosshair } from "./crosshair-model.ts";

export function parsePreset(text: string): Crosshair {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object") throw new Error("预设格式无效");
  const preset = value as Record<string, unknown>;
  if (preset.schemaVersion !== 3 || preset.kind !== "moligod.crosshair")
    throw new Error("不支持的预设类型或版本");
  if (!preset.crosshair || typeof preset.crosshair !== "object")
    throw new Error("缺少准星参数");
  const c = preset.crosshair as Record<string, unknown>;
  const integer = (v: unknown, min: number, max: number): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
  if (
    !integer(c.size, 8, 96) ||
    !integer(c.thickness, 1, 8) ||
    !integer(c.gap, 0, 20) ||
    typeof c.color !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(c.color) ||
    typeof c.style !== "string" ||
    !["cross", "dot", "circle", "image"].includes(c.style) ||
    !integer(c.dotSize, 1, 32) ||
    !integer(c.opacity, 10, 100) ||
    !integer(c.imageScale, 5, 200) ||
    typeof c.monitor !== "string" ||
    c.monitor.length > 64 ||
    !integer(c.offsetX, -16384, 16384) ||
    !integer(c.offsetY, -16384, 16384) ||
    !(
      c.hotkey === null ||
      (typeof c.hotkey === "number" &&
        ([1, 2, 4, 5, 6].includes(c.hotkey) ||
          (integer(c.hotkey, 8, 254) && c.hotkey !== 229)))
    ) ||
    typeof c.hotkeyMode !== "string" ||
    !["toggle", "hold", "holdShow"].includes(c.hotkeyMode) ||
    !(
      c.imageId === null ||
      (typeof c.imageId === "string" && /^[0-9a-f]{64}$/i.test(c.imageId))
    )
  )
    throw new Error("准星参数不合法");
  return {
    size: c.size,
    thickness: c.thickness,
    gap: c.gap,
    color: c.color,
    style: c.style as Crosshair["style"],
    dotSize: c.dotSize,
    opacity: c.opacity,
    monitor: c.monitor,
    offsetX: c.offsetX,
    offsetY: c.offsetY,
    hotkey: c.hotkey,
    hotkeyMode: c.hotkeyMode as Crosshair["hotkeyMode"],
    imageId: c.imageId,
    imageScale: c.imageScale,
  };
}
