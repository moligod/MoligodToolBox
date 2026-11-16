export function bindModalTitlebarDrag(doc: Document, startDrag: () => void): void {
  const header = doc.querySelector<HTMLElement>(".app-header")!;
  const contains = (rect: DOMRect, x: number, y: number) =>
    x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
  doc.addEventListener("pointerdown", (event) => {
    const dialog = event.target;
    if (event.button !== 0 || !(dialog instanceof HTMLDialogElement) || !dialog.matches(":modal")) return;
    const { clientX: x, clientY: y } = event;
    if (y >= header.getBoundingClientRect().bottom || contains(dialog.getBoundingClientRect(), x, y)) return;
    event.preventDefault();
    startDrag();
  }, true);
}
