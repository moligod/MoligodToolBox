// Verify the Tauri minisign envelope using the public key embedded in the desktop configuration.
import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const [installer, version] = process.argv.slice(2);
const decode = (value) => Buffer.from(value, "base64");
const lines = (value) =>
  decode(value).toString("utf8").trimEnd().split(/\r?\n/);
const config = JSON.parse(
  readFileSync(
    new URL("../src-tauri/tauri.conf.json", import.meta.url),
    "utf8",
  ),
);
const pub = decode(lines(config.plugins.updater.pubkey)[1]);
const envelope = lines(readFileSync(installer + ".sig", "utf8"));
const packet = decode(envelope[1]);
assert.equal(pub.length, 42);
assert.equal(packet.length, 74);
assert.deepEqual(packet.subarray(2, 10), pub.subarray(2, 10));
assert.ok(envelope[2].startsWith("trusted comment: "));
const comment = envelope[2].slice("trusted comment: ".length);
const key = createPublicKey({
  key: Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    pub.subarray(10),
  ]),
  format: "der",
  type: "spki",
});
const algorithm = packet.toString("ascii", 0, 2);
assert.ok(algorithm === "ED" || algorithm === "Ed");
const bytes = readFileSync(installer);
const message =
  algorithm === "ED" ? createHash("blake2b512").update(bytes).digest() : bytes;
const signature = packet.subarray(10);
assert.ok(
  verify(null, message, key, signature),
  "Installer signature mismatch",
);
assert.ok(
  verify(
    null,
    Buffer.concat([signature, Buffer.from(comment)]),
    key,
    decode(envelope[3]),
  ),
  "Invalid signed metadata",
);
const fields = comment.split("\t");
for (const [name, expected] of [
  ["version", version],
  ["file", basename(installer)],
]) {
  assert.deepEqual(
    fields.filter((f) => f.startsWith(name + ":")),
    [name + ":" + expected],
  );
}
