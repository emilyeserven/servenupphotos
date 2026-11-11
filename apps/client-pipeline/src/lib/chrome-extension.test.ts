import assert from "node:assert/strict";
import { test } from "node:test";
import { chromeExtensionFiles, EXTENSION_FOLDER } from "@/lib/chrome-extension";
import { crc32 } from "@portfolio/lib/crc32";
import { zipFiles } from "@/lib/zip";

test("crc32 matches zip's checksum", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("a zip starts with a file header and ends with the directory's end, counting its files", () => {
  const zip = zipFiles([
    { path: "a/one.txt", text: "one" },
    { path: "a/two.txt", text: "two" },
  ]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
});

test("the extension's manifest is valid JSON and its worker opens the pipeline's Quick Edit", () => {
  const files = chromeExtensionFiles("http://192.168.1.20:8080");
  const byName = new Map(
    files.map((file) => [file.path.replace(`${EXTENSION_FOLDER}/`, ""), file]),
  );
  const manifest = JSON.parse(byName.get("manifest.json")!.text);
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "background.js");
  const worker = byName.get("background.js")!.text;
  // It parses as JavaScript (it isn't run: `chrome` exists only in the browser).
  assert.doesNotThrow(() => new Function(worker));
  assert.match(worker, /const PIPELINE = "http:\/\/192\.168\.1\.20:8080";/);
  assert.match(worker, /\/quick-edit\?url=/);
});
