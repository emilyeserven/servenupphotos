import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

let appRoot = process.cwd();

/** Receives the folder of the app being tested. */
export function initialize({ cwd }) {
  appRoot = cwd;
}

/** The folder an alias stands for, or undefined when the import isn't aliased. */
function aliasBase(specifier) {
  const portfolio = appRoot.endsWith("portfolio") ? "src" : "../portfolio/src";
  if (specifier.startsWith("@portfolio/"))
    return resolvePath(appRoot, portfolio, specifier.slice(11));
  if (specifier.startsWith("@/")) return resolvePath(appRoot, "src", specifier.slice(2));
  return undefined;
}

/** The file an aliased import means: the path with `.ts`, `.tsx` or `/index.ts` added if needed. */
function aliased(specifier) {
  const base = aliasBase(specifier);
  if (!base) return undefined;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, resolvePath(base, "index.ts")];
  const found = candidates.find((file) => /\.(tsx?|json)$/.test(file) && existsSync(file));
  return found && pathToFileURL(found).href;
}

/** Resolves the aliases to files; everything else resolves as Node does. */
export function resolve(specifier, context, nextResolve) {
  return nextResolve(aliased(specifier) ?? specifier, context);
}

/** Whether the file is one of the apps' own, not a dependency's. */
function isOwnFile(url) {
  return url.startsWith("file:") && !url.includes("/node_modules/");
}

/** Stands in for Vite's `import.meta.glob`, which finds no files here, so data modules use the committed JSON. */
function withoutGlob(source) {
  return String(source).replaceAll("import.meta.glob", "(() => ({}))");
}

/**
 * Loads a JSON file as a module's default export (Node wants an import attribute that the apps'
 * imports don't have), and takes out `import.meta.glob` from the apps' own files.
 */
export async function load(url, context, nextLoad) {
  const own = isOwnFile(url);
  if (own && url.endsWith(".json")) {
    const source = `export default ${readFileSync(new URL(url), "utf8")};`;
    return { format: "module", source, shortCircuit: true };
  }
  const loaded = await nextLoad(url, context);
  return own ? { ...loaded, source: withoutGlob(loaded.source) } : loaded;
}
