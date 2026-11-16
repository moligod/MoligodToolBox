export interface ImagePoint {
  x: number;
  y: number;
}
export function imagePoint(
  x: number,
  y: number,
  displayWidth: number,
  displayHeight: number,
  width: number,
  height: number,
): ImagePoint {
  return {
    x: Math.max(0, Math.min(width, Math.round((x / displayWidth) * width))),
    y: Math.max(0, Math.min(height, Math.round((y / displayHeight) * height))),
  };
}
export function imageRegion(a: ImagePoint, b: ImagePoint) {
  const x = Math.min(a.x, b.x),
    y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x),
    height = Math.abs(b.y - a.y);
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}
