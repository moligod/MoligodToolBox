import { spawnSync } from "node:child_process";
import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  rename,
  access,
  cp,
  rm,
  readdir,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

const release = process.argv.includes("--release");
const packageOnly = process.argv.includes("--package");
const profile = release ? "release" : "debug";
async function validateNativeRuntime(directory) {
  let size = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.toLowerCase() === "tensorrt_plugins.dll")
      throw new Error(
        "Unused TensorRT plugin must not be packaged; rerun scripts/prepare-ocr.ps1.",
      );
    if (
      /^(?:_internal|__pycache__|worker\.exe|python.*|pip.*)$/i.test(
        entry.name,
      ) ||
      /\.(?:py|pyc|pyd|whl)$/i.test(entry.name)
    )
      throw new Error(
        `Python artifact is forbidden in OCR runtime: ${join(directory, entry.name)}`,
      );
    const path = join(directory, entry.name);
    size += entry.isDirectory()
      ? await validateNativeRuntime(path)
      : (await stat(path)).size;
  }
  return size;
}
async function copyOcrRuntime(destination) {
  const resolved = resolve(destination);
  if (
    ![resolve("target"), resolve("bundled-modules")].some((base) =>
      resolved.startsWith(base + "\\"),
    ) ||
    !resolved.endsWith("\\ocr-runtime")
  )
    throw new Error("Refusing to modify an unmanaged OCR directory");
  // Only remove known obsolete runtime assets, never module/user data directories.
  await rm(join(resolved, "_internal"), { recursive: true, force: true });
  await rm(join(resolved, "worker.exe"), { force: true });
  await rm(join(resolved, "build.json"), { force: true });
  await rm(join(resolved, "nvidia", "tensorrt_plugins.dll"), { force: true });
  await cp("target/ocr-native-runtime", destination, { recursive: true });
  await copyFile(
    join("target", profile, "moligod-ocr.exe"),
    join(destination, "moligod-ocr.exe"),
  );
}
const modules = [{ id: "crosshair", package: "moligod-crosshair-module" }];
try {
  await access("modules/automation/Cargo.toml");
  modules.push({ id: "automation", package: "moligod-automation-module" });
} catch {}
if (modules.some((module) => module.id === "automation")) {
  const runtimeBytes = await validateNativeRuntime("target/ocr-native-runtime");
  if (runtimeBytes > 450 * 1048576)
    throw new Error("Native OCR assets exceed the 450 MiB budget");
  const inputs = JSON.parse(
    await readFile("target/ocr-native-runtime/assets.json", "utf8").catch(
      () => {
        throw new Error(
          "Prepare the offline OCR runtime first: see modules/ocr/README.md.",
        );
      },
    ),
  );
  for (const [name, expected] of Object.entries(inputs)) {
    const hash = createHash("sha256")
      .update(await readFile(join("target/ocr-native-runtime", name)))
      .digest("hex");
    if (expected !== hash)
      throw new Error(
        `Native OCR asset changed (${name}); rerun scripts/prepare-ocr.ps1.`,
      );
  }
  for (const tier of ["small", "tiny"]) {
    if (
      !(await readFile(`modules/ocr/config/${tier}.json`)).equals(
        await readFile(`target/ocr-native-runtime/models/${tier}/config.json`),
      )
    )
      throw new Error("OCR dictionary changed; rerun scripts/prepare-ocr.ps1.");
  }
}
const args = [
  "build",
  "--locked",
  ...modules.flatMap((module) => ["-p", module.package]),
  "-p",
  "moligod-ocr",
  ...(release ? ["--release"] : []),
];
const result = spawnSync("cargo", args, { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
await copyOcrRuntime("target/ocr-runtime");
const version = JSON.parse(await readFile("package.json", "utf8")).version;
await mkdir("bundled-modules/package", { recursive: true });
for (const module of modules) {
  const binary = join("target", profile, module.package + ".exe");
  const bytes = await readFile(binary);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const directory = join(
    "bundled-modules",
    release ? "release" : "dev",
    module.id,
  );
  await mkdir(directory, { recursive: true });
  const entry = `engine-${sha256.slice(0, 16)}.exe`;
  try {
    await access(join(directory, entry));
  } catch {
    await copyFile(binary, join(directory, entry));
  }
  if (module.id === "automation") {
    await access("target/ocr-runtime/moligod-ocr.exe").catch(() => {
      throw new Error(
        "OCR runtime missing. Run the setup in modules/ocr/README.md before building automation.",
      );
    });
    await copyOcrRuntime(join(directory, "ocr-runtime"));
  }
  const manifest = {
    id: module.id,
    version,
    protocol: 1,
    platform: "windows-x86_64",
    entry,
    sha256,
  };
  const temporary = join(directory, "manifest.tmp");
  await writeFile(temporary, JSON.stringify(manifest, null, 2) + "\n");
  await rename(temporary, join(directory, "manifest.json"));
  if (release) {
    const packageDirectory = join("bundled-modules/package", module.id);
    await mkdir(packageDirectory, { recursive: true });
    await copyFile(binary, join(packageDirectory, "engine.exe"));
    if (module.id === "automation") {
      await copyOcrRuntime(join(packageDirectory, "ocr-runtime"));
    }
    await writeFile(
      join(packageDirectory, "manifest.json"),
      JSON.stringify({ ...manifest, entry: "engine.exe" }, null, 2) + "\n",
    );
    const runtimeDirectory = join("target/release/modules", module.id);
    await mkdir(runtimeDirectory, { recursive: true });
    if (module.id === "automation") {
      await copyOcrRuntime(join(runtimeDirectory, "ocr-runtime"));
    }
    try {
      await access(join(runtimeDirectory, entry));
    } catch {
      await copyFile(binary, join(runtimeDirectory, entry));
    }
    await writeFile(
      join(runtimeDirectory, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
  }
  if (packageOnly) {
    const output = resolve(
      "module-packages",
      `${module.id}-${version}-windows-x86_64.zip`,
    );
    await mkdir("module-packages", { recursive: true });
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const assets =
      module.id === "automation"
        ? `,${quote(resolve(directory, "ocr-runtime"))}`
        : "";
    const command = `Compress-Archive -LiteralPath ${quote(resolve(directory, "manifest.json"))},${quote(resolve(directory, entry))}${assets} -DestinationPath ${quote(output)} -Force`;
    const zipped = spawnSync(
      "pwsh.exe",
      ["-NoLogo", "-NoProfile", "-Command", command],
      { stdio: "inherit", windowsHide: true },
    );
    if (zipped.status !== 0) process.exit(zipped.status ?? 1);
    console.log(`Packaged ${output}`);
  }
  console.log(
    `${module.id} ${version}: ${entry} (${(bytes.length / 1048576).toFixed(2)} MiB)`,
  );
}
