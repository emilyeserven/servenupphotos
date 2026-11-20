// Checks that every doc in docs/, and in a folder of it such as docs/trip-lines/, says what it is about at its top: a `# Title` on the first line,
// a blank line, then a sentence that says what the feature is (`.claude/rules/docs.md`). The docs
// folder is its own index, so a new doc edits no shared list. Exits 1 and lists each problem.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

/** What a summary line can't start with: a heading, table, list, quote or code block isn't a sentence. */
const NOT_A_SENTENCE = /^(#|\||[-*] |>|```|$)/;

/** What is wrong with the top of the doc, or nothing when it starts with a title and a summary. */
function problems(name, text) {
  const [title = "", gap = "", summary = ""] = text.split("\n");
  if (!title.startsWith("# ")) return [`docs/${name} doesn't start with a "# Title" line`];
  if (gap.trim() !== "" || NOT_A_SENTENCE.test(summary))
    return [`docs/${name} has no sentence saying what the feature is under its title`];
  return [];
}

const entries = await readdir(path.join(root, "docs"), { recursive: true, withFileTypes: true });
const names = entries
  .filter((e) => e.isFile() && e.name.endsWith(".md"))
  .map((e) => path.relative(path.join(root, "docs"), path.join(e.parentPath, e.name)));
const found = (
  await Promise.all(
    names.map(async (name) =>
      problems(name, await readFile(path.join(root, "docs", name), "utf8")),
    ),
  )
).flat();

if (found.length > 0) {
  for (const line of found) console.error(line);
  console.error(
    "Start each doc with its title, a blank line, then one sentence on what it covers.",
  );
  process.exit(1);
}
console.log(`Every doc starts with a title and a summary (${names.length} docs).`);
