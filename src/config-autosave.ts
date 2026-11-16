import type { Config } from "./api";
import { latestUpdate } from "./latest-update.ts";

/** One settings owner and one bounded write queue shared by every settings control. */
export function configAutosave(
  save: (config: Config) => Promise<unknown>,
  failed: (error: unknown) => void,
) {
  let config: Config | undefined;
  const writes = latestUpdate<Config>(async (next) => {
    await save(next);
  }, failed);
  writes.resume();
  return {
    initialize(value: Config) {
      config = structuredClone(value);
    },
    current: () => config,
    update(patch: Partial<Config>) {
      if (!config) return false;
      config = { ...config, ...patch };
      writes.push(structuredClone(config));
      return true;
    },
    idle: writes.idle,
  };
}
