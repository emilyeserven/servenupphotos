// Makes apps/portfolio/src/data/photos/ALLPHOTOS.local.json, which the portfolio uses in place of its dummy
// data whenever it has a photo in it. It's a copy of ALLPHOTOS.json from the open "Add photo data"
// pull request on the `origin` GitHub repository, so the portfolio shows the photos in flight. With
// no such pull request, or when GitHub can't be reached, it combines the photo JSON files in the
// folder instead, the same way the "Combine photo data" workflow builds ALLPHOTOS.json: every other
// JSON file in the folder, as one array sorted by file name. The local copy is
// git-ignored. Set GITHUB_TOKEN to read a private repository.
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_PATH = "apps/portfolio/src/data/photos";
const PR_TITLE = "Add photo data";
const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, DATA_PATH);
const outFile = path.join(dataDir, "ALLPHOTOS.local.json");
const skipped = new Set(["ALLPHOTOS.json", "ALLPHOTOS.local.json"]);

/** "owner/repo" of the `origin` remote, when it's on GitHub. */
function originRepo() {
  const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8" });
  return url.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1];
}

async function github(apiPath, accept = "application/vnd.github+json") {
  const headers = { Accept: accept };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${apiPath}`, { headers });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${apiPath}`);
  return res.json();
}

/** ALLPHOTOS.json at the head of the open photo data pull request, or undefined when there's none. */
async function fromOpenPullRequest() {
  const repo = originRepo();
  if (!repo) throw new Error("origin isn't a GitHub repository");
  const pulls = await github(`/repos/${repo}/pulls?state=open&per_page=100`);
  const pull = pulls.find((p) => p.title === PR_TITLE && p.head.repo?.full_name === repo);
  if (!pull) return undefined;
  const file = `/repos/${repo}/contents/${DATA_PATH}/ALLPHOTOS.json?ref=${pull.head.sha}`;
  const photos = await github(file, "application/vnd.github.raw+json");
  return { photos, from: `ALLPHOTOS.json from ${pull.html_url}` };
}

async function fromDataFolder() {
  const files = (await readdir(dataDir, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !skipped.has(entry.name))
    .map((entry) => entry.name)
    // Byte order, like `LC_ALL=C sort` in the workflow.
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  const photos = await Promise.all(
    files.map(async (name) => JSON.parse(await readFile(path.join(dataDir, name), "utf8"))),
  );
  return { photos, from: `${files.length} file(s) in ${DATA_PATH}` };
}

async function photoData() {
  try {
    const pr = await fromOpenPullRequest();
    if (pr) return pr;
    console.log(`No open "${PR_TITLE}" pull request.`);
  } catch (err) {
    console.warn(`Couldn't read the open "${PR_TITLE}" pull request: ${err.message}`);
  }
  return fromDataFolder();
}

const { photos, from } = await photoData();
// Written to a temporary file and moved into place, so Vite never reads half a file.
const tmpFile = `${outFile}.tmp`;
await mkdir(dataDir, { recursive: true });
await writeFile(tmpFile, `${JSON.stringify(photos, null, 2)}\n`);
await rename(tmpFile, outFile);
console.log(
  `Wrote ${photos.length} photo(s) to ${path.relative(process.cwd(), outFile)} from ${from}`,
);
