/** Calculate from the drag origin so direction changes never accumulate rounding errors. */
export function draggedOffset(
  value: number,
  origin: number,
  current: number,
  min: number,
  max: number,
): number {
  const base = Number.isFinite(value) ? value : 0;
  return Math.max(min, Math.min(max, Math.round(base + current - origin)));
}
