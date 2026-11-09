// Sample answers for the routes in routes_settings.go.
import { execFileSync } from "node:child_process";
import { BASE_BRANCH, CDN, REPO, root } from "./shared.mjs";

/** A page of the Changelog from this checkout's own last 40 commits, as GitHub would list them. */
function changelogFixture() {
  let log = "";
  try {
    log = execFileSync("git", ["log", "-40", "--no-merges", "--format=%H%x1f%an%x1f%cI%x1f%s"], {
      cwd: root,
      encoding: "utf8",
    });
  } catch {
    // No git history, such as in an exported copy: show an empty Changelog.
  }
  const entries = log.split("\n").filter(Boolean).map(changelogEntry);
  return { repo: REPO, branch: BASE_BRANCH, entries, nextPage: entries.length === 40 ? 2 : 0 };
}

/** One `git log` line (sha, author, date and subject, split by \x1f) as a Changelog entry. */
function changelogEntry(line) {
  const [sha, author, date, subject] = line.split("\x1f");
  const match = /\s*\(#(\d+)\)$/.exec(subject);
  const title = match ? subject.slice(0, match.index) : subject;
  const pr = match
    ? {
        pullRequest: Number(match[1]),
        pullRequestUrl: `https://github.com/${REPO}/pull/${match[1]}`,
      }
    : {};
  return {
    sha,
    title,
    ...pr,
    commitUrl: `https://github.com/${REPO}/commit/${sha}`,
    author,
    date,
    photoData: title === "Add photo data",
  };
}

const secret = { set: true, last4: "a1b2" };

/** The settings as `GET /api/settings` and the saves answer: everything set up. */
function settingsFixture() {
  return {
    r2: {
      accountId: "0123456789abcdef",
      accessKeyId: "fixture-access-key",
      secretAccessKey: secret,
      bucket: "servenupphotos",
      publicUrl: CDN,
    },
    github: {
      repo: REPO,
      branch: BASE_BRANCH,
      folder: "",
      token: secret,
      includeUntitled: false,
    },
  };
}

/** The sample answers for the settings routes, keyed "METHOD /api/path". */
export function settingsFixtures() {
  return {
    "GET /api/changelog": changelogFixture(),
    "GET /api/timeouts": { defaultSeconds: 30, prefixes: { "/upload": 150, "/data/colors": 300 } },
    "GET /api/settings": settingsFixture(),
    "POST /api/settings/r2/test": { ok: true, message: "Connected to bucket servenupphotos." },
    "POST /api/settings/github/test": { ok: true, message: `Connected to ${REPO}.` },
    "PUT /api/settings/r2": () => settingsFixture(),
    "PUT /api/settings/github": () => settingsFixture(),
  };
}
