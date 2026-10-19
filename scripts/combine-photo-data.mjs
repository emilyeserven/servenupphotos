// Combines the photo JSON files in apps/portfolio/src/data into ALLPHOTOS.local.json, the same way
// the "Combine photo data" workflow builds ALLPHOTOS.json: every other JSON file in the folder
// (except dummy.json), as one array sorted by file name. The local copy is git-ignored, and the
// portfolio uses it in place of its dummy data whenever it has a photo in it.
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve(import.meta.dirname, "../apps/portfolio/src/data");
const outFile = path.join(dataDir, "ALLPHOTOS.local.json");
const skipped = new Set(["ALLPHOTOS.json", "ALLPHOTOS.local.json", "dummy.json"]);

const files = (await readdir(dataDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !skipped.has(entry.name))
  .map((entry) => entry.name)
  // Byte order, like `LC_ALL=C sort` in the workflow.
  .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));

const photos = await Promise.all(
  files.map(async (name) => JSON.parse(await readFile(path.join(dataDir, name), "utf8"))),
);

// Written to a temporary file and moved into place, so Vite never reads half a file.
const tmpFile = `${outFile}.tmp`;
await writeFile(tmpFile, `${JSON.stringify(photos, null, 2)}\n`);
await rename(tmpFile, outFile);
console.log(`Combined ${files.length} file(s) into ${path.relative(process.cwd(), outFile)}`);
