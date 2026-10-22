// Makes ALLPHOTOS.local.json, PLACES.local.json and LOCALIZATIONS.local.json in
// apps/portfolio/src/data, which the portfolio uses in place of the committed ALLPHOTOS.json,
// PLACES.json and LOCALIZATIONS.json whenever they have anything in them. Each is a copy of the
// combined file from the open "Add photo data" pull request on the `origin` GitHub repository, so
// the portfolio shows the photos in flight. With no such pull request, or when GitHub can't be
// reached, it combines the JSON files in each folder instead, the same way the "Combine photo
// data" workflow builds the combined files: every other JSON file in the folder, as one array
// sorted by file name. The local copies are git-ignored. Set GITHUB_TOKEN to read a private
// repository.
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_PATH = "apps/portfolio/src/data";
const PR_TITLE = "Add photo data";
const root = path.resolve(import.meta.dirname, "..");

/** Each folder of JSON files and the combined file made from them. */
const KINDS = [
  { folder: "photos", all: "ALLPHOTOS" },
  { folder: "places", all: "PLACES" },
  { folder: "localizations", all: "LOCALIZATIONS" },
];

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

/** The open photo data pull request, or undefined when there's none. */
async function openPullRequest() {
  const repo = originRepo();
  if (!repo) throw new Error("origin isn't a GitHub repository");
  const pulls = await github(`/repos/${repo}/pulls?state=open&per_page=100`);
  const pull = pulls.find((p) => p.title === PR_TITLE && p.head.repo?.full_name === repo);
  return pull && { repo, pull };
}

/** A combined file at the head of the pull request; an empty list when it isn't there yet. */
async function fromPullRequest({ repo, pull }, kind) {
  const file = `/repos/${repo}/contents/${DATA_PATH}/${kind.folder}/${kind.all}.json?ref=${pull.head.sha}`;
  const items = await github(file, "application/vnd.github.raw+json").catch(() => []);
  return { items, from: `${kind.all}.json from ${pull.html_url}` };
}

async function fromDataFolder(kind) {
  const dataDir = path.join(root, DATA_PATH, kind.folder);
  const skipped = new Set([`${kind.all}.json`, `${kind.all}.local.json`]);
  const files = (await readdir(dataDir, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !skipped.has(entry.name))
    .map((entry) => entry.name)
    // Byte order, like `LC_ALL=C sort` in the workflow.
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  const items = await Promise.all(
    files.map(async (name) => JSON.parse(await readFile(path.join(dataDir, name), "utf8"))),
  );
  return { items, from: `${files.length} file(s) in ${DATA_PATH}/${kind.folder}` };
}

/** The open pull request, or undefined when there's none or GitHub can't be reached. */
async function findPullRequest() {
  try {
    const pr = await openPullRequest();
    if (!pr) console.log(`No open "${PR_TITLE}" pull request.`);
    return pr;
  } catch (err) {
    console.warn(`Couldn't read the open "${PR_TITLE}" pull request: ${err.message}`);
    return undefined;
  }
}

/** Writes one kind's local combined file. */
async function writeLocal(pr, kind) {
  const { items, from } = pr ? await fromPullRequest(pr, kind) : await fromDataFolder(kind);
  const dataDir = path.join(root, DATA_PATH, kind.folder);
  const outFile = path.join(dataDir, `${kind.all}.local.json`);
  // Written to a temporary file and moved into place, so Vite never reads half a file.
  const tmpFile = `${outFile}.tmp`;
  await mkdir(dataDir, { recursive: true });
  await writeFile(tmpFile, `${JSON.stringify(items, null, 2)}\n`);
  await rename(tmpFile, outFile);
  console.log(
    `Wrote ${items.length} item(s) to ${path.relative(process.cwd(), outFile)} from ${from}`,
  );
}

const pr = await findPullRequest();
for (const kind of KINDS) await writeLocal(pr, kind);
