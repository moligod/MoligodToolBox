import { test } from "node:test";
import assert from "node:assert/strict";
import Blockly from "blockly/core";
import { registerHooks } from "node:module";
const core = new URL("./blockly.mjs", import.meta.resolve("blockly/core")).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return specifier === "blockly/core"
      ? { url: core, shortCircuit: true }
      : next(specifier, context);
  },
});
const { registerBlocks } = await import("../src/automation-blockly-blocks.ts");
const { ValueDragStrategy, ValueConnectionChecker } =
  await import("../src/automation-blockly-snap.ts");
hooks.deregister();
import {
  encodeValue,
  scriptToWorkspace,
} from "../src/automation-blockly-codec.ts";
registerBlocks();

function fixture(t, value = { kind: "literal", value: true }, width = 220) {
  const workspace = new Blockly.Workspace();
  t.after(() => workspace.dispose());
  workspace.connectionChecker = new ValueConnectionChecker();
  Blockly.serialization.workspaces.load(
    scriptToWorkspace([
      {
        delayMs: 0,
        action: {
          type: "assert",
          expression: "",
          stopWhenTrue: true,
          message: "",
        },
      },
    ]),
    workspace,
  );
  const action = workspace
    .getAllBlocks(false)
    .find((b) => b.type === "moligod_action");
  const block = Blockly.serialization.blocks.append(
    encodeValue(value),
    workspace,
  );
  block.getHeightWidth = () => ({ width, height: 40 });
  const output = block.outputConnection,
    input = action.getInput("VALUE_expression").connection;
  const at = (connection, x, y) =>
    Object.assign(connection, {
      x,
      y,
      distanceFrom: Blockly.RenderedConnection.prototype.distanceFrom,
    });
  at(input, 100, 100);
  at(output, 100 + width / 2, 100);
  const strategy = new ValueDragStrategy(block);
  return {
    workspace,
    block,
    input,
    output,
    strategy,
    at,
    canSnap: () =>
      workspace.connectionChecker.canConnect(
        output,
        input,
        true,
        strategy.getSearchRadius(),
      ),
  };
}

test("a matching value halfway inside the condition row previews a connection before exact alignment", (t) => {
  const f = fixture(t);
  assert.equal(
    f.canSnap(),
    true,
    "half-width horizontal entry should snap without aligning the left tip",
  );
});

test("half-width entry works from both sides and respects zoom-independent block dimensions", (t) => {
  for (const width of [80, 220, 420]) {
    const f = fixture(t, { kind: "literal", value: true }, width);
    for (const scale of [0.5, 1, 1.5]) {
      f.workspace.scale = scale;
      for (const direction of [-1, 1]) {
        f.at(f.output, 100 + (direction * width) / 2, 100);
        assert.equal(f.canSnap(), true);
      }
    }
    f.at(f.output, 100 + width + 60, 100);
    assert.equal(f.canSnap(), false);
  }
});

test("nearby rows, incompatible types and already-filled real inputs do not gain broad snapping", (t) => {
  const f = fixture(t);
  f.at(f.output, 200, 100 + Blockly.config.snapRadius + 1);
  assert.equal(f.canSnap(), false);
  const numeric = fixture(t, { kind: "literal", value: 1 });
  assert.equal(numeric.canSnap(), false);
  const existing = Blockly.serialization.blocks.append(
    encodeValue({ kind: "literal", value: false }),
    f.workspace,
  );
  f.input.connect(existing.outputConnection);
  f.at(f.output, 200, 100);
  assert.equal(f.canSnap(), false);
  f.at(f.output, 110, 100);
  assert.equal(
    f.canSnap(),
    true,
    "explicit close-range replacement keeps Blockly's original behavior",
  );
});

test("keyboard traversal and statement connections keep their original rules", (t) => {
  const f = fixture(t);
  f.at(f.output, 500, 500);
  assert.equal(
    f.workspace.connectionChecker.canConnect(f.output, f.input, true, Infinity),
    true,
  );
  const action = f.input.getSourceBlock();
  const sibling = Blockly.serialization.blocks.append(
    {
      type: "moligod_action",
      extraState: { step: { delayMs: 0, action: { type: "wait", ms: 1000 } } },
    },
    f.workspace,
  );
  f.at(action.nextConnection, 100, 100);
  f.at(sibling.previousConnection, 200, 100);
  assert.equal(
    f.workspace.connectionChecker.canConnect(
      sibling.previousConnection,
      action.nextConnection,
      true,
      Blockly.config.snapRadius,
    ),
    false,
  );
});
