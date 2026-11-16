import { decodeLibrary, type GameLibrary } from "./game-library-model.ts";

export function mergeGameLibraries(
  current: GameLibrary,
  incoming: GameLibrary,
  replace = false,
): GameLibrary {
  decodeLibrary(current);
  decodeLibrary(incoming);
  const games = new Map(current.games.map((game) => [game.id, game]));
  for (const game of incoming.games) {
    if (replace || !games.has(game.id)) games.set(game.id, game);
  }
  return decodeLibrary({ schemaVersion: 1, games: [...games.values()] });
}
