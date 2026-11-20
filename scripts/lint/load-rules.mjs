/**
 * Reads the repository's own oxlint rules from `scripts/lint/rules/`: one file per rule, named after
 * the rule (`error-note.mjs` is `servenup/error-note`). A new rule is a new file there; nothing
 * else lists the rules.
 */
import { readdir } from "node:fs/promises";

const folder = new URL("./rules/", import.meta.url);
const files = (await readdir(folder)).filter((name) => name.endsWith(".mjs")).toSorted();

/**
 * Every rule file, by rule name: its `default` export is the rule and its `severity` export is how
 * loudly oxlint reports it ("warn" or "error").
 */
export const ruleFiles = Object.fromEntries(
  await Promise.all(
    files.map(async (name) => [name.replace(/\.mjs$/, ""), await import(new URL(name, folder))]),
  ),
);
