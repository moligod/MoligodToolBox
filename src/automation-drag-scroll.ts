/** Run only while a pointer drag is active; a stationary pointer keeps scrolling. */
export function startDragScroll(
  root: HTMLElement,
  pointer: () => { x: number; y: number } | undefined,
  scrolled: () => void,
) {
  let frame = 0;
  let previous: number | undefined;
  function tick(time: number) {
    frame = 0;
    const point = pointer();
    const bounds = root.getBoundingClientRect();
    if (!point || !root.isConnected || !bounds.height) return;
    const elapsed = Math.min(32, previous === undefined ? 16 : time - previous);
    previous = time;
    const edge = Math.min(36, bounds.height / 3);
    let speed = 0;
    if (point.x >= bounds.left && point.x <= bounds.right) {
      if (point.y < bounds.top + edge)
        speed = -Math.min(1, (bounds.top + edge - point.y) / edge);
      else if (point.y > bounds.bottom - edge)
        speed = Math.min(1, (point.y - bounds.bottom + edge) / edge);
    }
    const before = root.scrollTop;
    root.scrollTop = Math.max(
      0,
      Math.min(
        root.scrollHeight - root.clientHeight,
        before + speed * elapsed * 0.6,
      ),
    );
    frame = requestAnimationFrame(tick);
    if (root.scrollTop !== before) scrolled();
  }
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
