import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

async function sizesOf(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const sizes = await Promise.all(
    entries.map(async (entry) =>
      entry.isDirectory()
        ? sizesOf(join(path, entry.name))
        : {
            path: join(path, entry.name),
            size: (await stat(join(path, entry.name))).size,
          },
    ),
  );
  return sizes.flat();
}
const files = await sizesOf("dist");
const isBlockly = (file) =>
  /[\\/]blockly[\\/]|[\\/]automation-blockly-workspace-[^\\/]+\.js$/.test(
    file.path,
  );
for (const [name, entries, budget] of [
  ["Application", files.filter((file) => !isBlockly(file)), 254],
  ["Lazy Blockly editor + offline media", files.filter(isBlockly), 799],
]) {
  const bytes = entries.reduce((sum, file) => sum + file.size, 0);
  console.log(
    `${name}: ${(bytes / 1024).toFixed(1)} KiB / ${budget} KiB budget (uncompressed)`,
  );
  if (bytes > budget * 1024)
    throw new Error(
      "Frontend asset budget exceeded. Review architecture before increasing it.",
    );
}
