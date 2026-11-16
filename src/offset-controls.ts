import { draggedOffset } from "./offset-drag";

export function bindOffsetControls(dialog: HTMLElement, changed: () => void) {
  let held:
    | {
        button: HTMLButtonElement;
        pointerId: number;
        field: HTMLInputElement;
        axis: "x" | "y";
        originX: number;
        originY: number;
        value: number;
        moved: boolean;
      }
    | undefined;
  function stop() {
    const previous = held;
    held = undefined;
    if (previous) {
      previous.button.classList.remove("dragging");
      if (previous.button.hasPointerCapture(previous.pointerId))
        previous.button.releasePointerCapture(previous.pointerId);
    }
  }
  const abort = new AbortController();
  const options = { signal: abort.signal };
  dialog
    .querySelectorAll<HTMLButtonElement>("[data-offset]")
    .forEach((button) => {
      const field = document.getElementById(
        button.dataset.offset!,
      ) as HTMLInputElement;
      const step = () => {
        if (dialog.hidden || button.disabled) return;
        field.value = String(
          draggedOffset(
            field.valueAsNumber,
            0,
            Number(button.dataset.step),
            Number(field.min),
            Number(field.max),
          ),
        );
        changed();
      };
      button.addEventListener(
        "pointerdown",
        (event) => {
          if (event.button !== 0 || held) return;
          event.preventDefault();
          button.focus();
          button.setPointerCapture(event.pointerId);
          button.classList.add("dragging");
          held = {
            button,
            pointerId: event.pointerId,
            field,
            axis: field.id === "aim-y" ? "y" : "x",
            originX: event.clientX,
            originY: event.clientY,
            value: field.valueAsNumber,
            moved: false,
          };
        },
        options,
      );
      button.addEventListener(
        "pointermove",
        (event) => {
          if (
            !held ||
            held.button !== button ||
            held.pointerId !== event.pointerId
          )
            return;
          if ((event.buttons & 1) === 0) {
            stop();
            return;
          }
          const deltaX = event.clientX - held.originX,
            deltaY = event.clientY - held.originY;
          if (deltaX !== 0 || deltaY !== 0) held.moved = true;
          const value = draggedOffset(
            held.value,
            held.axis === "x" ? held.originX : held.originY,
            held.axis === "x" ? event.clientX : event.clientY,
            Number(field.min),
            Number(field.max),
          );
          if (value !== field.valueAsNumber) {
            field.value = String(value);
            changed();
          }
        },
        options,
      );
      button.addEventListener(
        "pointerup",
        (event) => {
          if (
            !held ||
            held.button !== button ||
            held.pointerId !== event.pointerId
          )
            return;
          const clicked = !held.moved;
          stop();
          if (clicked) step();
        },
        options,
      );
      for (const type of ["pointercancel", "lostpointercapture", "blur"])
        button.addEventListener(
          type,
          () => {
            if (held?.button === button) stop();
          },
          options,
        );
      button.addEventListener(
        "keydown",
        (event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            if (!event.repeat) step();
          }
        },
        options,
      );
      button.addEventListener(
        "keyup",
        (event) => {
          if (event.key === " " || event.key === "Enter")
            event.preventDefault();
        },
        options,
      );
      button.addEventListener(
        "click",
        (event) => {
          if (event.detail === 0) step();
        },
        options,
      );
    });
  window.addEventListener("blur", stop, options);
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) stop();
    },
    options,
  );
  dialog.addEventListener("close", stop, options);
  return () => {
    stop();
    abort.abort();
  };
}
