// Runs every check, as `pnpm check` and CI do: oxlint, oxfmt, typecheck and fallow, then every file
// in scripts/checks/. A new check is a new file there; nothing else lists the checks. Name checks
// to run only those, such as `pnpm check fixtures` or `pnpm check lint docs`. Every check runs even
// after one fails, and the failed ones are listed at the end. Exits 1 when any failed.
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

/** The checks that are tools with their own package.json script, in the order they run. */
const TOOLS = ["lint", "fmt:check", "typecheck", "fallow"];

/** Every check by name: the tools first, then each file in scripts/checks/ under its file name. */
async function allChecks() {
  const files = (await readdir(path.join(root, "scripts/checks")))
    .filter((name) => name.endsWith(".mjs"))
    .toSorted();
  return new Map([
    ...TOOLS.map((tool) => [tool, ["pnpm", ["-s", tool]]]),
    ...files.map((file) => [
      file.replace(/\.mjs$/, ""),
      [process.execPath, [path.join("scripts/checks", file)]],
    ]),
  ]);
}

/** Runs one check with its output shown, and says whether it passed. */
function passes(name, [command, args]) {
  console.log(`\n── ${name} ──`);
  return spawnSync(command, args, { cwd: root, stdio: "inherit" }).status === 0;
}

const checks = await allChecks();
const asked = process.argv.slice(2);
const unknown = asked.filter((name) => !checks.has(name));
if (unknown.length > 0) {
  console.error(
    `No check named ${unknown.join(", ")}. The checks are: ${[...checks.keys()].join(", ")}.`,
  );
  process.exit(1);
}

const names = asked.length > 0 ? asked : [...checks.keys()];
const failed = names.filter((name) => !passes(name, checks.get(name)));
if (failed.length > 0) {
  console.error(`\nFailed: ${failed.join(", ")}. Run one again with \`pnpm check <name>\`.`);
  process.exit(1);
}
console.log(`\nAll ${names.length} checks passed.`);
