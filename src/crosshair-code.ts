import type { Crosshair } from "./crosshair-model.ts";
import { parsePreset } from "./preset.ts";

const styles = ["cross", "dot", "circle", "image"] as const;
export const IMAGE_CODE_UNSUPPORTED = "自定义图片禁止生成准星码";
function checksum(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
/** Portable appearance only; local monitor, position, input binding and files stay private. */
export function createCrosshairCode(value: Crosshair): string {
  if (value.style === "image") throw new Error(IMAGE_CODE_UNSUPPORTED);
  const c = parsePreset(
    JSON.stringify({
      schemaVersion: 3,
      kind: "moligod.crosshair",
      crosshair: value,
    }),
  );
  const body = btoa(
    JSON.stringify([
      styles.indexOf(c.style),
      c.size,
      c.thickness,
      c.gap,
      c.dotSize,
      c.opacity,
      c.color,
      c.imageScale,
    ]),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `MG1.${body}.${checksum(body)}`;
}
export function readCrosshairCode(code: string, local: Crosshair): Crosshair {
  const match = /^MG1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(code.trim());
  if (code.length > 1024 || !match || checksum(match[1]) !== match[2])
    throw new Error("准星码无效或不完整，请重新复制");
  let parts: unknown;
  try {
    parts = JSON.parse(atob(match[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    throw new Error("准星码无法解析");
  }
  if (
    !Array.isArray(parts) ||
    parts.length !== 8 ||
    !Number.isInteger(parts[0]) ||
    parts[0] < 0 ||
    parts[0] >= styles.length
  )
    throw new Error("准星码格式不支持");
  const [style, size, thickness, gap, dotSize, opacity, color, imageScale] =
    parts;
  return parsePreset(
    JSON.stringify({
      schemaVersion: 3,
      kind: "moligod.crosshair",
      crosshair: {
        ...local,
        style: styles[style],
        size,
        thickness,
        gap,
        dotSize,
        opacity,
        color,
        imageScale,
        imageId: styles[style] === "image" ? null : local.imageId,
      },
    }),
  );
}
