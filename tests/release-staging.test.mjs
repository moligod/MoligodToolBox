import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

test("staging checks signed bytes, signed version, and immutable asset inventory", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "toolbox-release-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, "input"),
    scripts = join(dir, "scripts"),
    config = join(dir, "src-tauri");
  for (const path of [source, scripts, config]) mkdirSync(path);
  for (const name of [
    "verify-release-signature.mjs",
    "stage-download-source.py",
  ])
    copyFileSync(
      new URL("../scripts/" + name, import.meta.url),
      join(scripts, name),
    );
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const b64 = (bytes) => Buffer.from(bytes).toString("base64");
  const keyId = Buffer.from("fixture1");
  const publicData = Buffer.concat([
    Buffer.from("Ed"),
    keyId,
    publicKey.export({ format: "der", type: "spki" }).subarray(-32),
  ]);
  writeFileSync(
    join(config, "tauri.conf.json"),
    JSON.stringify({
      plugins: {
        updater: {
          pubkey: b64("untrusted comment: fixture\n" + b64(publicData)),
        },
      },
    }),
  );
  const version = "2.0.2",
    name = "MoligodToolBox_2.0.2_x64-setup.exe",
    bytes = Buffer.from("fixture");
  const sig = sign(
    null,
    createHash("blake2b512").update(bytes).digest(),
    privateKey,
  );
  function manifest(signedVersion) {
    const comment = "timestamp:1\tfile:" + name + "\tversion:" + signedVersion;
    const packet = Buffer.concat([Buffer.from("ED"), keyId, sig]);
    const global = sign(
      null,
      Buffer.concat([sig, Buffer.from(comment)]),
      privateKey,
    );
    const signature = b64(
      [
        "untrusted comment: fixture",
        b64(packet),
        "trusted comment: " + comment,
        b64(global),
      ].join("\n"),
    );
    writeFileSync(join(source, name + ".sig"), signature);
    const url =
      "https://github.com/moligod/MoligodToolBox/releases/download/v" +
      version +
      "/" +
      name;
    writeFileSync(
      join(source, "latest.json"),
      JSON.stringify({
        version,
        platforms: { "windows-x86_64": { url, signature } },
      }),
    );
  }
  function stage() {
    const res = spawnSync(
      process.platform === "win32" ? "python" : "python3",
      [join(scripts, "stage-download-source.py"), source, join(dir, "www")],
      { encoding: "utf8" },
    );
    if (res.error) throw res.error;
    return res;
  }
  const product = join(dir, "www", "moligod-toolbox");
  manifest(version);
  writeFileSync(join(source, name), "changed");
  assert.notEqual(stage().status, 0);
  assert.equal(existsSync(join(product, "latest.json")), false);
  writeFileSync(join(source, name), bytes);
  manifest("2.0.1");
  assert.notEqual(stage().status, 0);
  assert.equal(existsSync(join(product, "releases", "v" + version)), false);
  manifest(version);
  writeFileSync(join(source, "private-note.txt"), "test only");
  const good = stage();
  assert.equal(good.status, 0, good.stderr);
  const release = join(product, "releases", "v" + version);
  assert.equal(existsSync(join(release, "private-note.txt")), false);
  writeFileSync(join(release, "extra.txt"), "test only");
  const bad = stage();
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Unexpected release inventory/);
});
