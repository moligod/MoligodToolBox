import type { Step } from "./automation-editor";
import { bindingBefore, parseBlocks } from "./automation-block-model.ts";
import type { ActionCategory } from "./automation-blockly-toolbox.ts";

export interface BlocklyOptions {
  names: Record<string, string>;
  categories?: ActionCategory[];
  scale?: () => number | undefined;
  componentBackend?: import("./automation-blockly-components.ts").ComponentBackend;
  running: () => boolean;
  update: (steps: Step[]) => void;
  notify: (text: string, error?: boolean) => void;
  slots: () => string[];
  windows?: () => string[];
  refreshWindows?: () => Promise<void>;
  tasks?: () => {id:string;name:string}[];
  refreshTasks?: () => Promise<{id:string;name:string}[]>;
  configure?: (step: Step, parent: HTMLElement, update: () => void) => void;
  beforeRender?: () => void;
  issues?: (step: Step) => string[];
}
type Runtime = ReturnType<
  typeof import("./automation-blockly-workspace").createBlocklyWorkspace
>;

/** Keep Blockly out of startup: load it only when the automation page is opened. */
export function createBlocklyEditor(
  root: HTMLElement,
  options: BlocklyOptions,
) {
  let current: Step[] = [],
    runtime: Runtime | undefined;
  let loading: Promise<void> | undefined;
  let disposed = false;
  let running = false;
  let revision = 0;
  let status: { running: boolean; step: number } | undefined;
  const wrapped = {
    ...options,
    update: (steps: Step[]) => {
      current = structuredClone(steps);
      options.update(steps);
    },
  };
  async function activate() {
    if (runtime) {
      runtime.resize();
      return;
    }
    if (loading) return loading;
    root.textContent = "正在加载积木编辑器…";
    loading = import("./automation-blockly-workspace")
      .then((module) => {
        if (disposed) return;
        runtime = module.createBlocklyWorkspace(root, wrapped);
        runtime.render(current);
        runtime.setRunning(running);
        runtime.highlight(status);
      })
      .catch((error) => {
        root.textContent = "积木编辑器加载失败，切换页面可重试。";
        options.notify(String(error), true);
      })
      .finally(() => {
        loading = undefined;
      });
    return loading;
  }
  return {
    activate,
    render(steps: Step[]) {
      revision++;
      current = structuredClone(steps);
      runtime?.render(current);
    },
    insert(step: Step) {
      const requestedRevision = revision;
      if (!running)
        void activate().then(() => {
          if (!disposed && !running && requestedRevision === revision)
            runtime?.insert(step);
        });
    },
    flush() {
      runtime?.flush();
    },
    setRunning(value: boolean) {
      running = value;
      runtime?.setRunning(value);
    },
    highlight(value?: { running: boolean; step: number }) {
      status = value;
      runtime?.highlight(value);
    },
    rescale(ratio: number) {
      runtime?.rescale(ratio);
    },
    windowBinding(step: Step | undefined, slot: string) {
      return (
        runtime?.windowBinding(step, slot) ??
        bindingBefore(parseBlocks(current), step, slot)
      );
    },
    refreshValidation() {
      runtime?.refreshValidation();
    },
    cancelDrag() {
      runtime?.cancelDrag();
    },
    dispose() {
      disposed = true;
      runtime?.dispose();
      runtime = undefined;
    },
  };
}
