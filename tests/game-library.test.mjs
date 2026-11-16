import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  decodeLibrary,
  emptyLibrary,
  validateGame,
} from "../src/game-library-model.ts";

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/games/library-v1.json", import.meta.url),
    "utf8",
  ),
);

function sampleGame(changes = {}) {
  return { ...fixture.games[0], ...changes };
}

test("decodes the versioned local game library fixture", () => {
  const library = decodeLibrary(fixture);
  assert.equal(library.schemaVersion, 1);
  assert.equal(library.games[0].title, "星港回响");
  assert.equal(library.games[0].description.includes("\n"), true);
  assert.deepEqual(emptyLibrary(), { schemaVersion: 1, games: [] });
});

test("rejects future versions and unknown persisted fields", () => {
  assert.throws(() => decodeLibrary({ ...fixture, schemaVersion: 2 }));
  assert.throws(() => decodeLibrary({ ...fixture, unexpected: true }));
  assert.throws(() =>
    decodeLibrary({
      ...fixture,
      games: [{ ...fixture.games[0], unsupported: "no" }],
    }),
  );
});

test("rejects malformed or mismatched image data", () => {
  assert.throws(() =>
    decodeLibrary({
      ...fixture,
      games: [
        sampleGame({
          cover: "data:image/png;base64,/9j/",
        }),
      ],
    }),
  );
  assert.throws(() =>
    decodeLibrary({
      ...fixture,
      games: [sampleGame({ cover: "data:image/svg+xml;base64,PHN2Zy8+" })],
    }),
  );
});

test("rejects duplicate IDs during import", () => {
  assert.throws(() =>
    decodeLibrary({
      ...fixture,
      games: [sampleGame(), sampleGame({ title: "另一个同 ID 游戏" })],
    }),
  );
});

test("counts text as Unicode code points and validates published requirements", () => {
  const longTitle = "🎮".repeat(121);
  assert.match(validateGame(sampleGame({ title: longTitle }))[0], /名称/);
  assert.match(
    validateGame(sampleGame({ subtitle: "   " }))[0],
    /展示游戏需要/,
  );
  assert.deepEqual(
    validateGame(sampleGame({ status: "draft", cover: "" })),
    [],
  );
});
