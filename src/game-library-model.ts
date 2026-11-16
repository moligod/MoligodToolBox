export type GameStatus = "draft" | "published";

export interface Game {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  platforms: string[];
  tags: string[];
  cover: string;
  hero: string;
  screenshots: string[];
  status: GameStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GameLibrary {
  schemaVersion: 1;
  games: Game[];
}

export const GAME_LIBRARY_SCHEMA_VERSION = 1 as const;
export const MAX_GAMES = 100;
export const MAX_SCREENSHOTS = 6;
export const MAX_IMAGE_BYTES = 1_572_864;
export const MAX_LIBRARY_ENCODED_BYTES = 25_165_824;
export const MAX_IMAGE_DIMENSION = 8_192;
export const MAX_IMAGE_PIXELS = 16_000_000;

type RecordValue = Record<string, unknown>;

const gameKeys = [
  "id",
  "title",
  "subtitle",
  "description",
  "developer",
  "publisher",
  "releaseDate",
  "platforms",
  "tags",
  "cover",
  "hero",
  "screenshots",
  "status",
  "featured",
  "createdAt",
  "updatedAt",
] as const;
const libraryKeys = ["schemaVersion", "games"] as const;
const controlCharacters = /[\u0000-\u001f\u007f]/;
const imageDataUrl =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/;
const base64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const idFormat = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function record(value: unknown): RecordValue | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as RecordValue)
    : undefined;
}

function hasOwn(object: RecordValue, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function exactKeys(object: RecordValue, keys: readonly string[]): boolean {
  return (
    Object.keys(object).length === keys.length &&
    keys.every((key) => hasOwn(object, key))
  );
}

function text(
  value: unknown,
  min: number,
  max: number,
  multiline = false,
): value is string {
  const forbidden = multiline
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : controlCharacters;
  return (
    typeof value === "string" &&
    Array.from(value).length >= min &&
    Array.from(value).length <= max &&
    !forbidden.test(value)
  );
}

function stringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): value is string[] {
  if (!Array.isArray(value) || value.length > maxItems) return false;
  const seen = new Set<string>();
  return value.every((item) => {
    if (
      !text(item, 1, maxLength) ||
      item.trim() !== item ||
      !item.trim() ||
      seen.has(item)
    )
      return false;
    seen.add(item);
    return true;
  });
}

function validCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validIsoTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/.exec(
      value,
    );
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

function bytesFromBase64(value: string): Uint8Array | undefined {
  if (!base64.test(value)) return undefined;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return undefined;
  }
}

function imageMagic(bytes: Uint8Array): string | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return undefined;
}

export function validateImageDataUrl(value: unknown): boolean {
  if (value === "") return true;
  if (typeof value !== "string") return false;
  const match = imageDataUrl.exec(value);
  if (!match) return false;
  const bytes = bytesFromBase64(match[2]);
  return (
    Boolean(bytes) &&
    bytes!.byteLength <= MAX_IMAGE_BYTES &&
    imageMagic(bytes!) === match[1]
  );
}

export interface GameValidationOptions {
  requirePublished?: boolean;
}

export function validateGame(
  value: unknown,
  options: GameValidationOptions = {},
): string[] {
  const game = record(value);
  if (!game || !exactKeys(game, gameKeys)) return ["游戏资料字段不受支持"];
  const errors: string[] = [];
  const title = typeof game.title === "string" ? game.title : "";
  const subtitle = typeof game.subtitle === "string" ? game.subtitle : "";
  if (typeof game.id !== "string" || !idFormat.test(game.id))
    errors.push("游戏标识无效");
  if (!text(title, 1, 120) || !title.trim()) errors.push("游戏名称无效");
  if (!text(subtitle, 0, 200)) errors.push("短介绍无效");
  if (!text(game.description, 0, 10_000, true)) errors.push("详细介绍无效");
  if (!text(game.developer, 0, 120)) errors.push("开发商无效");
  if (!text(game.publisher, 0, 120)) errors.push("发行商无效");
  if (
    typeof game.releaseDate !== "string" ||
    (game.releaseDate !== "" && !validCalendarDate(game.releaseDate))
  )
    errors.push("发行日期无效");
  if (!stringList(game.platforms, 12, 48)) errors.push("游戏平台无效");
  if (!stringList(game.tags, 24, 32)) errors.push("标签无效");
  if (!validateImageDataUrl(game.cover)) errors.push("封面图片无效");
  if (!validateImageDataUrl(game.hero)) errors.push("横幅图片无效");
  if (
    !Array.isArray(game.screenshots) ||
    game.screenshots.length > MAX_SCREENSHOTS ||
    !game.screenshots.every(
      (image) => image !== "" && validateImageDataUrl(image),
    )
  )
    errors.push("游戏截图无效");
  if (game.status !== "draft" && game.status !== "published")
    errors.push("发布状态无效");
  if (typeof game.featured !== "boolean") errors.push("推荐状态无效");
  if (!validIsoTime(game.createdAt) || !validIsoTime(game.updatedAt))
    errors.push("创建或更新时间无效");
  if (
    (game.status === "published" || options.requirePublished) &&
    (!title.trim() ||
      !subtitle.trim() ||
      !Array.isArray(game.platforms) ||
      !game.platforms.length ||
      !game.cover)
  )
    errors.push("展示游戏需要名称、短介绍、游戏平台和封面");
  return errors;
}

function gameImageStringBytes(game: Game): number {
  return (
    game.cover.length +
    game.hero.length +
    game.screenshots.reduce((total, image) => total + image.length, 0)
  );
}

function encodedBytes(value: unknown): number | undefined {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return undefined;
  }
}

export function emptyLibrary(): GameLibrary {
  return { schemaVersion: GAME_LIBRARY_SCHEMA_VERSION, games: [] };
}

export function decodeLibrary(raw: unknown): GameLibrary {
  let source = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source) as unknown;
    } catch {
      throw new Error("游戏资料库不是有效 JSON");
    }
  }
  const library = record(source);
  if (!library || !exactKeys(library, libraryKeys))
    throw new Error("游戏资料库字段不受支持");
  if (library.schemaVersion !== GAME_LIBRARY_SCHEMA_VERSION)
    throw new Error("不支持的游戏资料库版本");
  if (!Array.isArray(library.games) || library.games.length > MAX_GAMES)
    throw new Error("游戏数量超出限制");

  const games = library.games as unknown[];
  const ids = new Set<string>();
  let imageBytes = 0;
  for (const game of games) {
    const errors = validateGame(game);
    if (errors.length) throw new Error(errors[0]);
    const typed = game as Game;
    if (ids.has(typed.id)) throw new Error("游戏标识重复");
    ids.add(typed.id);
    imageBytes += gameImageStringBytes(typed);
  }
  if (imageBytes > MAX_LIBRARY_ENCODED_BYTES)
    throw new Error("游戏图片资料超过 24 MiB 限制");
  const totalBytes = encodedBytes(library);
  if (totalBytes === undefined || totalBytes > MAX_LIBRARY_ENCODED_BYTES)
    throw new Error("游戏资料库超过 24 MiB 限制");
  return { schemaVersion: GAME_LIBRARY_SCHEMA_VERSION, games: games as Game[] };
}
