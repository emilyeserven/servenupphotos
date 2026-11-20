// Checks that Claude's instruction files stay easy to merge (`.claude/rules/shared-files.md`):
// CLAUDE.md stays short, and neither it nor a file in .claude/rules/ holds a markdown table, which
// the formatter re-pads on every edit. Exits 1 and lists each problem.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

/** The most lines CLAUDE.md may have. A new convention is a new file in .claude/rules/, not a line here. */
const MAX_LINES = 90;

/** A markdown table's divider row, such as `| --- | --- |`. */
const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*\|/;

/** The problems in one instruction file, given its path from the repo root. */
async function problems(file) {
  const lines = (await readFile(path.join(root, file), "utf8")).split("\n");
  const found = [];
  const table = lines.findIndex((line) => TABLE_DIVIDER.test(line));
  if (table !== -1)
    found.push(`${file}:${table + 1} is a table. Write a list, one entry per line.`);
  if (file === "CLAUDE.md" && lines.length > MAX_LINES)
    found.push(
      `CLAUDE.md has ${lines.length} lines (at most ${MAX_LINES}). Move a convention to its own file in .claude/rules/.`,
    );
  return found;
}

const rules = (await readdir(path.join(root, ".claude/rules")))
  .filter((name) => name.endsWith(".md"))
  .map((name) => `.claude/rules/${name}`);
const files = ["CLAUDE.md", ...rules];
const found = (await Promise.all(files.map(problems))).flat();

if (found.length > 0) {
  for (const line of found) console.error(line);
  process.exit(1);
}
console.log(`Claude's instruction files are short and table-free (${files.length} files).`);
