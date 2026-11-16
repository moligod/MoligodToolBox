import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeGameLibraries } from "../src/game-library-merge.ts";

const game = (id, title = id) => ({
  id,
  title,
  subtitle: "",
  description: "",
  developer: "",
  publisher: "",
  releaseDate: "",
  platforms: [],
  tags: [],
  cover: "",
  hero: "",
  screenshots: [],
  status: "draft",
  featured: false,
  createdAt: "2026-10-23T00:00:00.000Z",
  updatedAt: "2026-10-23T00:00:00.000Z",
});
const library = (...games) => ({ schemaVersion: 1, games });

test("import preserves unrelated games and local conflicts unless replacement is explicit", () => {
  const local = library(game("existing", "本机修改"), game("untouched"));
  const incoming = library(game("existing", "备份版本"), game("new"));
  const merged = mergeGameLibraries(local, incoming);
  assert.deepEqual(
    merged.games.map((game) => game.title),
    ["本机修改", "untouched", "new"],
  );
  assert.equal(
    mergeGameLibraries(local, incoming, true).games[0].title,
    "备份版本",
  );
  assert.equal(local.games[0].title, "本机修改");
});

test("import rejects a combined library above capacity without mutating either input", () => {
  const local = library(
    ...Array.from({ length: 100 }, (_, index) => game(`game-${index}`)),
  );
  const incoming = library(game("overflow"));
  assert.throws(() => mergeGameLibraries(local, incoming));
  assert.equal(local.games.length, 100);
  assert.equal(incoming.games.length, 1);
});

test("invalid import is rejected before it can replace a valid local record", () => {
  const local = library(game("existing"));
  const broken = library({
    ...game("existing"),
    unknownFutureField: "preserve me",
  });
  assert.throws(() => mergeGameLibraries(local, broken, true));
  assert.equal(local.games[0].title, "existing");
});
