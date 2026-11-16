import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";

const roots = process.argv.slice(2);
if (!roots.length)
  roots.push("target/release/moligod.exe", "bundled-modules/package");
const prefixes = [...new Set([process.cwd(), homedir()])].flatMap((path) => [
  path,
  path.replaceAll("\\", "/"),
  path.replaceAll("\\", "\\\\"),
]);
const patterns = prefixes.flatMap((path) =>
  ["utf8", "utf16le"].map((encoding) => ({
    encoding,
    bytes: Buffer.from(path, encoding),
  })),
);
const findings = [];
let files = 0;
async function scan(path) {
  if ((await stat(path)).isDirectory()) {
    for (const entry of await readdir(path)) await scan(join(path, entry));
    return;
  }
  files++;
  const name = relative(process.cwd(), path).replaceAll("\\", "/");
  if (/\.(?:key|pem|pfx|p12|dmp|log)$|(?:^|\/)\.env(?:\.|$)/i.test(name))
    findings.push({ file: name, kind: "private-file" });
  const bytes = await readFile(path);
  for (const pattern of patterns) {
    if (bytes.includes(pattern.bytes)) {
      findings.push({
        file: name,
        kind: "local-build-path",
        encoding: pattern.encoding,
      });
      break;
    }
  }
  const text = bytes.toString("latin1");
  if (
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(
      text,
    )
  )
    findings.push({ file: name, kind: "credential" });
}
for (const root of roots) await scan(resolve(root));
const report = { files, findings };
await writeFile(
  "target/release-privacy-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (findings.length) process.exitCode = 1;
