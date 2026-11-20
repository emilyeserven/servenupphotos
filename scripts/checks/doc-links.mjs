// Checks that the links between the docs still land: every relative link in README.md, CLAUDE.md,
// docs/ and .claude/rules/ points at a file that exists, and a link with a `#heading` part points
// at a heading that file has. Web links are left alone. Exits 1 and lists each broken link.
import { existsSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const FOLDERS = ["docs", ".claude/rules"];
const LINK = /\]\(([^)\s]+)\)/g;

/** Every markdown file under the folder, as paths from the repo root. */
async function markdownIn(folder) {
  const entries = await readdir(path.join(root, folder), { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.relative(root, path.join(e.parentPath, e.name)));
}

/** The text with its fenced code blocks and inline code blanked, so sample links in code aren't read. */
function withoutCode(text) {
  return text.replace(/^```[\s\S]*?^```/gm, "").replace(/`[^`\n]*`/g, "");
}

/** A heading as GitHub names it in a link: lowercase, punctuation dropped, spaces as hyphens. */
function anchorOf(heading) {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\- ]/gu, "")
    .replaceAll(" ", "-");
}

const anchors = new Map();

/** The anchors of the file's headings, read once. */
async function anchorsIn(file) {
  if (!anchors.has(file)) {
    const text = (await readFile(path.join(root, file), "utf8")).replace(/^```[\s\S]*?^```/gm, "");
    const headings = [...text.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) => anchorOf(heading));
    anchors.set(file, new Set(headings));
  }
  return anchors.get(file);
}

/** Whether the link goes to the web or is rooted at the site, which this check leaves alone. */
function isOutside(link) {
  return /^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith("/");
}

/** Whether the markdown file at `to` has a heading the anchor names. A folder or other file has none to miss. */
async function hasHeading(to, anchor) {
  if (!to.endsWith(".md") || statSync(path.join(root, to)).isDirectory()) return true;
  return (await anchorsIn(to)).has(decodeURIComponent(anchor).toLowerCase());
}

/** The file a link written in `file` points at, from the repo root. A bare `#heading` points at `file`. */
function targetOf(file, target) {
  return target ? path.normalize(path.join(path.dirname(file), target)) : file;
}

/** What is wrong with a link from `file` to the heading `anchor` of the file `to`, or nothing when `to` has it. */
async function headingProblem(file, link, to, anchor) {
  if (anchor === "" || (await hasHeading(to, anchor))) return [];
  return [`${file} links ${link}, but ${to} has no heading "#${anchor}"`];
}

/** What is wrong with one link written in `file`, or nothing when it lands. */
async function problem(file, link) {
  if (isOutside(link)) return [];
  const [target, anchor = ""] = link.split("#");
  const to = targetOf(file, target);
  if (!existsSync(path.join(root, to))) return [`${file} links ${link}, which does not exist`];
  return headingProblem(file, link, to, anchor);
}

/** The broken links in one file. */
async function problems(file) {
  const text = withoutCode(await readFile(path.join(root, file), "utf8"));
  const links = [...text.matchAll(LINK)].map(([, link]) => link);
  return (await Promise.all(links.map((link) => problem(file, link)))).flat();
}

const files = ["README.md", "CLAUDE.md", ...(await Promise.all(FOLDERS.map(markdownIn))).flat()];
const found = (await Promise.all(files.map(problems))).flat();

if (found.length > 0) {
  for (const line of found) console.error(line);
  console.error("Point each link at a file and heading that exist.");
  process.exit(1);
}
console.log(`Every link between the docs lands (${files.length} files).`);
