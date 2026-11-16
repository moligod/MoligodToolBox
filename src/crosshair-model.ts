export type CrosshairStyle = "cross" | "dot" | "circle" | "image";
export interface Crosshair {
  size: number;
  thickness: number;
  gap: number;
  color: string;
  style: CrosshairStyle;
  dotSize: number;
  opacity: number;
  monitor: string;
  offsetX: number;
  offsetY: number;
  hotkey: number | null;
  hotkeyMode: "toggle" | "hold" | "holdShow";
  imageId: string | null;
  imageScale: number;
}
export const defaultCrosshair: Crosshair = {
  size: 24,
  thickness: 2,
  gap: 4,
  color: "#c4f568",
  style: "cross",
  dotSize: 4,
  opacity: 100,
  monitor: "",
  offsetX: 0,
  offsetY: 0,
  hotkey: 119,
  hotkeyMode: "toggle",
  imageId: null,
  imageScale: 100,
};
