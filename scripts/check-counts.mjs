// Checks that "1 photo, 2 photos" is written with count() from apps/portfolio/src/lib/words.ts
// (CLAUDE.md, "Conventions") and not by hand. It flags a number written next to its noun with an
// inline `=== 1 ?`, such as `${n} ${n === 1 ? "photo" : "photos"}`, `n === 1 ? "1 photo" : …` or
// `photo${n === 1 ? "" : "s"}`. Agreeing a verb ("is" or "are") or wording one and many differently
// ("the photo" or "3 photos") stays inline. Exits 1 and lists each line.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const FOLDERS = ["apps/client-pipeline/src", "apps/portfolio/src", "apps/portfolio/map-preview"];
const WORDS = "apps/portfolio/src/lib/words.ts";

/** The shapes of a count written by hand. */
const BY_HAND = [
  // n === 1 ? "1 photo" : `${n} photos`
  /=== 1 \? "1 /,
  // photo${n === 1 ? "" : "s"}
  /=== 1 \? "" : "s"/,
  // {n} {n === 1 ? "photo" : "photos"} and ${n} ${n === 1 ? "photo" : "photos"}
  /\{([\w.]+)(?:\.toLocaleString\(\))?\} \$?\{\1 === 1 \? /,
];

/** Every .ts and .tsx file under the folder, as paths from the repo root. */
async function sourceFiles(folder) {
  const entries = await readdir(path.join(root, folder), { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => path.relative(root, path.join(e.parentPath, e.name)));
}

const files = (await Promise.all(FOLDERS.map(sourceFiles))).flat().filter((f) => f !== WORDS);
const found = [];
for (const file of files) {
  const lines = (await readFile(path.join(root, file), "utf8")).split("\n");
  lines.forEach((line, i) => {
    if (BY_HAND.some((shape) => shape.test(line))) found.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}

if (found.length > 0) {
  for (const line of found) console.error(line);
  console.error(`Write these with count(n, "photo") from @portfolio/lib/words (${WORDS}).`);
  process.exit(1);
}
console.log(`No counts written by hand (${files.length} files).`);
