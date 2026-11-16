/** At most one request in flight and one latest value waiting. No idle timer. */
export function latestUpdate<T>(
  send: (value: T) => Promise<void>,
  failed: (error: unknown) => void,
) {
  let pending: { value: T } | undefined;
  let active: Promise<void> | undefined;
  let paused = true;
  function drain() {
    if (paused || active || !pending) return;
    active = (async () => {
      while (!paused && pending) {
        const { value } = pending;
        pending = undefined;
        try {
          await send(value);
        } catch (error) {
          failed(error);
        }
      }
    })().finally(() => {
      active = undefined;
      drain();
    });
  }
  return {
    push(value: T) {
      pending = { value };
      drain();
    },
    resume() {
      paused = false;
      drain();
    },
    pause() {
      paused = true;
      return active ?? Promise.resolve();
    },
    clear() {
      pending = undefined;
    },
    async idle() {
      while (active) await active;
    },
  };
}
