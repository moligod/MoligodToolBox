import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const sections = [
  "MoligodToolBox dependency license notices",
  "Includes available license, copyright and notice files for locked Rust and npm dependencies, including build tools. GPU runtime terms are supplied separately under modules/automation/ocr-runtime/licenses.",
];
const missing = [];
async function append(name, directory, fallback = true) {
  const files = (await readdir(directory)).filter((file) =>
    /^(?:licen[sc]e|copying|copyright|notice)(?:$|[._-])/i.test(file),
  );
  let found = false;
  for (const file of files.sort()) {
    const path = join(directory, file);
    if (!(await stat(path)).isFile()) continue;
    found = true;
    sections.push(
      `\n===== ${name} / ${file} =====\n`,
      await readFile(path, "utf8"),
    );
  }
  if (!found && fallback) {
    const manifest = await readFile(
      join(directory, "Cargo.toml"),
      "utf8",
    ).catch(() => null);
    if (manifest) {
      const repository = /^repository = "https:\/\/github.com\/([^"\n]+)"/m
        .exec(manifest)?.[1]
        ?.replace(/\.git\/?$/, "")
        .replace(/\/$/, "");
      const upstream =
        repository &&
        join("docs/licenses/upstream", repository.replaceAll("/", "-"));
      if (upstream && (await stat(upstream).catch(() => null)))
        found = await append(name, upstream, false);
      if (!found)
        sections.push(
          `\n===== ${name} / published package metadata =====\n`,
          manifest.split("[package]")[1]?.split(/\n\[/)[0] || manifest,
        );
    } else {
      const pkg = JSON.parse(
        await readFile(join(directory, "package.json"), "utf8"),
      );
      sections.push(
        `\n===== ${name} / published package metadata =====\n`,
        JSON.stringify(
          {
            name: pkg.name,
            version: pkg.version,
            license: pkg.license,
            author: pkg.author,
            contributors: pkg.contributors,
            repository: pkg.repository,
          },
          null,
          2,
        ),
      );
    }
    if (!found) missing.push(name);
  }
  return found;
}
const registry = join(
  process.env.CARGO_HOME || join(homedir(), ".cargo"),
  "registry",
  "src",
);
const registries = await readdir(registry);
const cargoLock = await readFile("Cargo.lock", "utf8");
for (const entry of cargoLock.split("[[package]]")) {
  if (!entry.includes('source = "registry+')) continue;
  const name = /^name = "([^"]+)"/m.exec(entry)?.[1];
  const version = /^version = "([^"]+)"/m.exec(entry)?.[1];
  sections.push(
    `\nRust source: https://crates.io/api/v1/crates/${name}/${version}/download`,
  );
  for (const source of registries) {
    const directory = join(registry, source, `${name}-${version}`);
    if (await stat(directory).catch(() => null)) {
      await append(`${name} ${version} (Rust)`, directory);
      break;
    }
  }
}
const npmLock = JSON.parse(await readFile("package-lock.json", "utf8"));
for (const [directory, info] of Object.entries(npmLock.packages)) {
  if (!directory || !(await stat(directory).catch(() => null))) continue;
  await append(
    `${directory.replace(/^node_modules\//, "")} ${info.version} (npm)`,
    directory,
  );
}
await writeFile("docs/licenses/DEPENDENCIES.txt", sections.join("\n") + "\n");
console.log(JSON.stringify({ sections: sections.length, missing }, null, 2));
