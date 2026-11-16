/** Pointer sorting avoids Windows WebView's native file-drag interception. */
export function taskDrag(handle: HTMLElement, row: HTMLElement, list: HTMLElement, begin: () => boolean, finish: (target?: {id: string; after: boolean}) => void) {
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !begin()) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture(event.pointerId);
    const listeners = new AbortController(), signal = listeners.signal;
    let y = event.clientY, x = event.clientX, moved = false, frame = 0, done = false;
    let target: {id: string; after: boolean} | undefined;
    const marks = () => list.querySelectorAll(".auto-task-row").forEach(item => item.classList.remove("drop-before","drop-after"));
    const locate = () => {
      marks(); target = undefined;
      if (!moved) return;
      const box = list.getBoundingClientRect();
      if (x < box.left || x > box.right) return;
      const rows = [...list.querySelectorAll<HTMLElement>(".auto-task-row")];
      const over = rows.find(item => y < item.getBoundingClientRect().bottom) ?? rows[rows.length-1];
      if (!over || over === row) return;
      const bounds = over.getBoundingClientRect(), after = y > bounds.top + bounds.height / 2;
      target = {id:over.dataset.taskId!,after};
      over.classList.add(after ? "drop-after" : "drop-before");
    };
    const scroll = () => {
      const bounds = list.getBoundingClientRect();
      if (moved) {
        const change = y < bounds.top + 24 ? -6 : y > bounds.bottom - 24 ? 6 : 0;
        if (change) {list.scrollTop += change; locate();}
      }
      frame = requestAnimationFrame(scroll);
    };
    const end = (commit: boolean) => {
      if (done) return;
      done = true; listeners.abort(); cancelAnimationFrame(frame); marks();
      row.classList.remove("dragging");
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      finish(commit && moved ? target : undefined);
    };
    handle.addEventListener("pointermove", next => {
      if (next.pointerId !== event.pointerId) return;
      y=next.clientY; x=next.clientX;
      moved ||= Math.abs(y-event.clientY)>4;
      row.classList.toggle("dragging",moved); locate();
    },{signal});
    handle.addEventListener("pointerup", next => {if(next.pointerId === event.pointerId) end(true);},{signal});
    handle.addEventListener("pointercancel",()=>end(false),{signal});
    handle.addEventListener("lostpointercapture",()=>end(false),{signal});
    window.addEventListener("blur",()=>end(false),{signal});
    window.addEventListener("pagehide",()=>end(false),{signal});
    document.addEventListener("visibilitychange",()=>{if(document.hidden) end(false);},{signal});
    document.addEventListener("keydown",key=>{if(key.key === "Escape") {key.preventDefault();end(false);}},{signal});
    frame = requestAnimationFrame(scroll);
  });
}
