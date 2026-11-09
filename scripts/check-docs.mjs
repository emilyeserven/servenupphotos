// Checks that the README's Features list and the docs/ folder match: every docs/<name>.md is linked
// from the "## Features" section of README.md, and every docs/<name>.md link in that section points at
// a file that exists (CLAUDE.md, "Docs"). Exits 1 and lists each problem.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

/** Docs that are intentionally not a feature line in the README. Empty: every doc is a feature. */
const UNLISTED = new Set([]);

const DOC_LINK = /docs\/([A-Za-z0-9_-]+\.md)/g;

/** The text of the README's "## Features" section, up to the next "## " heading. */
function featuresSection(readme) {
  const start = readme.search(/^## Features\s*$/m);
  if (start === -1) return "";
  const rest = readme.slice(start + 1);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The doc file names (such as `gallery.md`) the text links to. */
function linkedDocs(text) {
  return new Set([...text.matchAll(DOC_LINK)].map(([, name]) => name));
}

/** The problems between the docs on disk and the ones the Features list links. */
function problems(onDisk, linked) {
  const unlinked = onDisk.filter((name) => !linked.has(name) && !UNLISTED.has(name));
  const dangling = [...linked].filter((name) => !onDisk.includes(name));
  return [
    ...unlinked.map((n) => `docs/${n} is not linked from the Features list in README.md`),
    ...dangling.map((n) => `README.md's Features list links docs/${n}, which does not exist`),
  ];
}

const readme = await readFile(path.join(root, "README.md"), "utf8");
const onDisk = (await readdir(path.join(root, "docs"))).filter((n) => n.endsWith(".md"));
const found = problems(onDisk, linkedDocs(featuresSection(readme)));

if (found.length > 0) {
  for (const line of found) console.error(line);
  console.error(
    "Add one line per doc to the Features list in README.md (or list it in UNLISTED in scripts/check-docs.mjs).",
  );
  process.exit(1);
}
console.log(`README's Features list and docs/ match (${onDisk.length} docs).`);
