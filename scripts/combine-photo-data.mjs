// Makes ALLPHOTOS.local.json, PLACES.local.json and LOCALIZATIONS.local.json in
// apps/portfolio/src/data, which the portfolio uses in place of the committed ALLPHOTOS.json,
// PLACES.json and LOCALIZATIONS.json whenever they have anything in them. It asks, in turn:
//
// 1. The photo pipeline, when it's running locally (PIPELINE_URL, or else http://localhost:8080
//    or http://localhost:5174): the combined files at the open "Add photo data" pull request's
//    head, with the pull request's own photo, place and localization files over them, so saves
//    not committed with Commit yet show too.
// 2. GitHub: the combined files from the open "Add photo data" pull request on the `origin`
//    repository. Set GITHUB_TOKEN to read a private repository.
// 3. The data folders: every other JSON file in each, as one array sorted by file name, the same
//    way the "Combine photo data" workflow builds the combined files.
//
// `--pipeline-only` skips 2 and 3 and leaves the files as they are when the pipeline isn't
// running; the portfolio's dev server runs it that way on each page load. `--quiet` only prints
// problems. A file is only written when it changes, so the dev server reloads only then. The local
// copies are git-ignored.
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_PATH = "apps/portfolio/src/data";
const pipelineOnly = process.argv.includes("--pipeline-only");
const quiet = process.argv.includes("--quiet");
const log = quiet ? () => {} : console.log;
const PR_TITLE = "Add photo data";
const root = path.resolve(import.meta.dirname, "..");

/** Each folder of JSON files and the combined file made from them. */
const KINDS = [
  { folder: "photos", all: "ALLPHOTOS", identity: "file" },
  { folder: "places", all: "PLACES", identity: "id" },
  { folder: "localizations", all: "LOCALIZATIONS", identity: "id" },
];

/** Where the local photo pipeline may be running: as set, `pnpm dev:pipeline` or Docker, then `pnpm dev:docker`. */
const PIPELINE_URLS = process.env.PIPELINE_URL
  ? [process.env.PIPELINE_URL]
  : ["http://localhost:8080", "http://localhost:5174"];

async function pipelineJson(base, apiPath) {
  const res = await fetch(`${base}${apiPath}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`the pipeline answered ${res.status} for ${apiPath}`);
  return res.json();
}

/** Whether the photo pipeline answers at base with JSON. */
async function answers(base) {
  const res = await fetch(`${base}/api/settings`, { signal: AbortSignal.timeout(2_000) }).catch(
    () => undefined,
  );
  return Boolean(res?.ok && res.headers.get("content-type")?.includes("json"));
}

/** The first pipeline URL that answers, or undefined when none is running. */
async function runningPipeline() {
  for (const base of PIPELINE_URLS) if (await answers(base)) return base;
  return undefined;
}

/** The kind's files in the pull request, as the pipeline's Photos in Flight reads them. */
function inFlightFiles(inFlight, kind) {
  return kind.folder === "photos" ? inFlight.files : (inFlight[kind.folder]?.files ?? []);
}

/** entries with each of the pull request's files over the entry with the same identity, or added. */
function withFiles(entries, files, identity) {
  const merged = [...entries];
  for (const { data } of files) {
    if (!data) continue;
    const at = merged.findIndex((entry) => entry?.[identity] === data[identity]);
    if (at === -1) merged.push(data);
    else merged[at] = data;
  }
  return merged;
}

/** Each kind's entries from the local pipeline, or undefined when it isn't running or can't say. */
async function fromPipeline() {
  const base = await runningPipeline();
  if (!base) return undefined;
  try {
    const [combined, inFlight] = await Promise.all([
      pipelineJson(base, "/api/photos/combined"),
      pipelineJson(base, "/api/photos/in-flight"),
    ]);
    const lists = combined.head ?? combined.base;
    return Object.fromEntries(
      KINDS.map((kind) => [
        kind.folder,
        withFiles(lists[kind.folder]?.data ?? [], inFlightFiles(inFlight, kind), kind.identity),
      ]),
    );
  } catch (err) {
    console.warn(`Couldn't read the photo pipeline at ${base}: ${err.message}`);
    return undefined;
  }
}

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
    if (!pr) log(`No open "${PR_TITLE}" pull request.`);
    return pr;
  } catch (err) {
    console.warn(`Couldn't read the open "${PR_TITLE}" pull request: ${err.message}`);
    return undefined;
  }
}

/** Writes one kind's local combined file, unless it already has these items. */
async function writeLocal(kind, items, from) {
  const dataDir = path.join(root, DATA_PATH, kind.folder);
  const outFile = path.join(dataDir, `${kind.all}.local.json`);
  const content = `${JSON.stringify(items, null, 2)}\n`;
  const old = await readFile(outFile, "utf8").catch(() => undefined);
  const where = path.relative(process.cwd(), outFile);
  if (old === content) return log(`${where} is up to date with ${from}`);
  // Written to a temporary file and moved into place, so Vite never reads half a file.
  const tmpFile = `${outFile}.tmp`;
  await mkdir(dataDir, { recursive: true });
  await writeFile(tmpFile, content);
  await rename(tmpFile, outFile);
  log(`Wrote ${items.length} item(s) to ${where} from ${from}`);
}

/** Writes each kind from GitHub's pull request, or else the data folders. */
async function fromGitHubOrFolders() {
  const pr = await findPullRequest();
  for (const kind of KINDS) {
    const { items, from } = pr ? await fromPullRequest(pr, kind) : await fromDataFolder(kind);
    await writeLocal(kind, items, from);
  }
}

const piped = await fromPipeline();
if (piped) {
  for (const kind of KINDS) await writeLocal(kind, piped[kind.folder], "the photo pipeline");
} else if (pipelineOnly) {
  log("The photo pipeline isn't running; the local data files are left as they are.");
} else {
  await fromGitHubOrFolders();
}
