import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const metadata = JSON.parse(
  execFileSync(
    "cargo",
    ["metadata", "--no-deps", "--format-version", "1", "--locked"],
    { encoding: "utf8" },
  ),
);
const allowed = {
  "moligod-ocr": new Set([
    "serde",
    "serde_json",
    "image",
    "imageproc",
    "ort",
    "windows",
  ]),
  "moligod-core": new Set(["serde"]),
  "moligod-storage": new Set(["moligod-core", "serde_json", "tempfile"]),
  "moligod-crosshair": new Set([
    "moligod-core",
    "serde",
    "image",
    "sha2",
    "tempfile",
    "windows-sys",
  ]),
  "moligod-module-protocol": new Set(["serde", "serde_json"]),
  "moligod-module-host": new Set([
    "moligod-module-protocol",
    "serde",
    "serde_json",
    "sha2",
    "windows-sys",
    "tempfile",
    "moligod-core",
  ]),
  "moligod-automation": new Set([
    "moligod-core",
    "serde",
    "serde_json",
    "regex",
    "image",
    "sha2",
    "tempfile",
    "windows-sys",
    "windows",
    "windows-capture",
    "moligod-module-host",
  ]),
};
const host = metadata.packages.find((pkg) => pkg.name === "moligod");
for (const dependency of host.dependencies) {
  if (
    [
      "moligod-crosshair",
      "moligod-automation",
      "moligod-ocr",
      "image",
      "opencv",
      "ort",
    ].includes(dependency.name)
  )
    throw new Error(
      "Tool execution dependencies must not be linked into the platform host: " +
        dependency.name,
    );
}
for (const pkg of metadata.packages) {
  const rule = allowed[pkg.name];
  if (rule)
    for (const dep of pkg.dependencies) {
      if (!rule.has(dep.name))
        throw new Error(
          `${pkg.name} unexpectedly depends on ${dep.name}; review the dependency boundary.`,
        );
    }
}
async function checkFrontend(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkFrontend(path);
    else if (
      path.endsWith(".ts") &&
      entry.name !== "api.ts" &&
      (await readFile(path, "utf8")).includes("@tauri-apps/")
    ) {
      throw new Error(`${path}: keep native access inside api.ts adapters.`);
    }
  }
}
await checkFrontend("src");
console.log("Dependency boundaries passed.");
