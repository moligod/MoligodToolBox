import type * as Blockly from "blockly/core";

type State = Blockly.serialization.blocks.State;
export interface RecycledBlock {
  key: number;
  state: State;
  ids: string[];
}

/** Session-local deletion history. Identical actions count as separate deletions. */
export class RecycleHistory {
  readonly entries: RecycledBlock[] = [];
  private serial = 0;
  add(state: State, ids: string[]) {
    this.entries.unshift({key:++this.serial,state:structuredClone(state),ids:[...ids]});
    this.entries.splice(30);
  }
  remove(key: number) {
    const index = this.entries.findIndex(entry => entry.key === key);
    if (index >= 0) this.entries.splice(index,1);
  }
  restored(ids: string[]) {
    const restored = new Set(ids);
    for (const entry of [...this.entries])
      if (entry.ids.length && entry.ids.every(id => restored.has(id))) this.remove(entry.key);
  }
}

/** Fresh Blockly identities only; action fields, nesting and legacy metadata stay intact. */
export function recycledState(state: State): State {
  const copy = structuredClone(state);
  function clean(block: State) {
    delete block.id;
    delete block.x;
    delete block.y;
    for (const input of Object.values(block.inputs ?? {})) {
      if (input.block) clean(input.block);
      if (input.shadow) clean(input.shadow);
    }
    if (block.next?.block) clean(block.next.block);
  }
  clean(copy);
  return copy;
}
