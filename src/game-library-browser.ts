import {
  decodeLibrary,
  emptyLibrary,
  type GameLibrary,
} from "./game-library-model";

// Preview data has its own store; the desktop adapter always uses the native file.
function connect(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("moligod-game-library", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("library");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("无法打开浏览器资料库，请检查存储权限。"));
    request.onblocked = () =>
      reject(new Error("资料库升级被其他页面阻止，请关闭其他预览页后重试。"));
  });
}

export async function browserGameLibrary(
  next?: GameLibrary,
): Promise<GameLibrary> {
  if (next) decodeLibrary(next);
  const db = await connect();
  try {
    return await new Promise<GameLibrary>((resolve, reject) => {
      const transaction = db.transaction(
        "library",
        next ? "readwrite" : "readonly",
      );
      const store = transaction.objectStore("library");
      const request = store.get("current");
      let result = emptyLibrary();
      let failure: unknown;
      request.onsuccess = () => {
        try {
          const current =
            request.result === undefined
              ? emptyLibrary()
              : decodeLibrary(request.result);
          result = next ?? current;
          if (next) {
            if (request.result !== undefined) store.put(current, "previous");
            store.put(next, "current");
          }
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = transaction.onerror = () =>
        reject(
          failure ??
            new Error(
              "资料库读写失败，原资料已保留。请检查可用空间与存储权限。",
            ),
        );
    });
  } finally {
    db.close();
  }
}
