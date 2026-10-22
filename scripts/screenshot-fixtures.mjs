// Sample answers for the pipeline's /api routes, so `pnpm shot pipeline …` can show every page
// without the Go backend, R2 or GitHub. They're built from the committed portfolio data in
// apps/portfolio/src/data, so they keep up with the photo JSON's fields on their own, plus one
// "Add photo data" pull request that adds a photo, an album and a tag.
//
// Each key is "METHOD /api/path" (no query string). A value is the JSON body to answer with, or a
// function of the request ({ url, body }) that returns { status, body } or a body.
// To change an answer for one screenshot, pass `--fixtures my-fixtures.mjs`, a module whose
// default export takes these fixtures and returns the ones to use.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const FOLDER = "apps/portfolio/src/data";
const REPO = "emilyeserven/servenupphotos";
const BASE_BRANCH = "main";
const CDN = "https://cdn.servenupphotos.net";

const PULL_REQUEST = {
  number: 90,
  title: "Add photo data",
  url: `https://github.com/${REPO}/pull/90`,
  branch: "photo-data/2026-10-22-120000",
  headSha: "f1x7ur3000000000000000000000000000000000",
};

const fileUrl = (filePath, branch = BASE_BRANCH) =>
  `https://github.com/${REPO}/blob/${branch}/${filePath}`;

/** Every JSON file in a data folder except the combined one, as { path, data }. */
function readFolder(kind, combined) {
  const dir = path.join(root, FOLDER, kind);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !name.startsWith(combined))
    .toSorted()
    .map((name) => ({
      path: `${FOLDER}/${kind}/${name}`,
      data: JSON.parse(readFileSync(path.join(dir, name), "utf8")),
    }));
}

const basePhotos = readFolder("photos", "ALLPHOTOS");
const baseAlbums = readFolder("albums", "ALLALBUMS");
const baseTags = readFolder("tags", "ALLTAGS");

/** A photo the pull request adds, made from the first committed photo with its own name and key. */
function newPhoto() {
  const stem = "a1b2c3d4e5f6-dscf3104";
  const images = Object.fromEntries(
    Object.entries(basePhotos[0].data.images ?? {}).map(([version, value]) => [
      version,
      typeof value === "string" ? value.replace(/[0-9a-f]{12}-[^/.-]+/, stem) : value,
    ]),
  );
  return {
    path: `${FOLDER}/photos/night-market.json`,
    data: {
      ...basePhotos[0].data,
      title: "Night market",
      comment: null,
      file: "DSCF3104.jpg",
      createDate: "2026:05:19 20:41:12",
      placeName: "Gwangjang Market",
      images: { ...images, key: `photos/${stem}.jpg` },
      albums: ["seoul"],
      tags: ["night"],
    },
  };
}

const added = {
  photo: newPhoto(),
  album: {
    path: `${FOLDER}/albums/seoul.json`,
    data: { id: "seoul", name: "Seoul", description: "Two weeks in Seoul.", parent: null },
  },
  tag: {
    path: `${FOLDER}/tags/night.json`,
    data: { id: "night", name: "Night", description: "" },
  },
};

const headPhotos = [...basePhotos, added.photo];
const headAlbums = [...baseAlbums, added.album];
const headTags = [...baseTags, added.tag];

function combinedFile(kind, all, files, branch) {
  const filePath = `${FOLDER}/${kind}/${all}`;
  return {
    path: filePath,
    found: true,
    fileUrl: fileUrl(filePath, branch),
    count: files.length,
    data: files.map((file) => file.data),
  };
}

function combinedFiles(photos, albums, tags, branch) {
  return {
    photos: combinedFile("photos", "ALLPHOTOS.json", photos, branch),
    albums: combinedFile("albums", "ALLALBUMS.json", albums, branch),
    tags: combinedFile("tags", "ALLTAGS.json", tags, branch),
  };
}

/** Each photo's original in R2, keyed by its JSON file's path. */
function imagesByPath(files) {
  const byPath = {};
  for (const { path: filePath, data } of files) {
    if (data.images?.key) {
      byPath[filePath] = { key: data.images.key, url: `${CDN}/${data.images.key}` };
    }
  }
  return { checked: true, byPath };
}

/** A photo's `images`, or an empty object for a photo saved before it was uploaded. */
const imagesOf = (data) => data.images ?? {};

function photoFile({ path: filePath, data }, status, branch) {
  const images = imagesOf(data);
  return {
    path: filePath,
    status,
    fileUrl: fileUrl(filePath, branch),
    data,
    photoName: data.file,
    imageUrl: images.full,
    imageKey: images.key,
  };
}

const groupFile = ({ path: filePath, data }) => ({
  path: filePath,
  status: "added",
  fileUrl: fileUrl(filePath, PULL_REQUEST.branch),
  data,
});

function group({ path: filePath, data }, inFlight) {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    ...(data.parent ? { parent: data.parent } : {}),
    path: filePath,
    fileUrl: fileUrl(filePath, inFlight ? PULL_REQUEST.branch : BASE_BRANCH),
    inFlight,
  };
}

const VERSIONS = [
  "xlarge",
  "large",
  "medium",
  "small",
  "xsmall",
  "preview",
  "thumbnail",
  "thumbnailpreview",
];

/** Every object an upload puts in R2 for each photo, newest photo first. */
function bucketImages() {
  return headPhotos
    .filter(({ data }) => data.images?.key)
    .toReversed()
    .flatMap(({ data }, i) => {
      const key = data.images.key;
      const stem = key.replace(/\.jpe?g$/, "");
      const modified = new Date(Date.UTC(2026, 9, 20 - i, 12)).toISOString();
      return [key, ...VERSIONS.map((version) => `${stem}-${version}.webp`)].map((k, j) => ({
        key: k,
        url: `${CDN}/${k}`,
        size: j === 0 ? 14_200_000 : 180_000 >> Math.min(j, 6),
        modified,
      }));
    });
}

const commit = (branch = PULL_REQUEST.branch) => ({
  branch,
  commitSha: PULL_REQUEST.headSha,
  commitUrl: `https://github.com/${REPO}/commit/${PULL_REQUEST.headSha}`,
  pullRequestUrl: PULL_REQUEST.url,
  pullRequestNumber: PULL_REQUEST.number,
  newPullRequest: false,
});

/** A photo as the Instagram calendar reads it: the first is scheduled, every other one eligible. */
function socialPhoto({ path: filePath, data }, i) {
  const images = imagesOf(data);
  return {
    path: filePath,
    fileUrl: fileUrl(filePath, PULL_REQUEST.branch),
    file: data.file,
    gpsPosition: data.gpsPosition,
    createDate: data.createDate,
    title: data.title,
    image: images.thumbnail ?? images.xsmall ?? null,
    isSocialMediaEligible: i % 2 === 0,
    socialMediaPublishDate: i === 0 ? "2026-10-23" : null,
  };
}

/** What saving a new photo JSON file to the open pull request answers. */
const savedPhoto = (filePath) => ({
  path: filePath,
  fileUrl: fileUrl(filePath, PULL_REQUEST.branch),
  pullRequestUrl: PULL_REQUEST.url,
  pullRequestNumber: PULL_REQUEST.number,
  newPullRequest: false,
});

const secret = { set: true, last4: "a1b2" };

/** The default answers: everything set up, and one photo data pull request open. */
export function defaultFixtures() {
  return {
    "GET /api/health": { status: "ok", bff: "ok", backend: "ok" },
    "GET /api/hello": { message: "Hello from be-pipeline (Go)" },
    "GET /api/settings": {
      r2: {
        accountId: "0123456789abcdef",
        accessKeyId: "fixture-access-key",
        secretAccessKey: secret,
        bucket: "servenupphotos",
        publicUrl: CDN,
      },
      github: { repo: REPO, branch: BASE_BRANCH, folder: "", token: secret },
    },
    "POST /api/settings/r2/test": { ok: true, message: "Connected to bucket servenupphotos." },
    "POST /api/settings/github/test": { ok: true, message: `Connected to ${REPO}.` },
    "GET /api/photos/combined": {
      repo: REPO,
      folder: FOLDER,
      base: { ...combinedFiles(basePhotos, baseAlbums, baseTags), branch: BASE_BRANCH },
      head: {
        ...combinedFiles(headPhotos, headAlbums, headTags, PULL_REQUEST.branch),
        pullRequest: PULL_REQUEST,
      },
    },
    "GET /api/photos/in-flight": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      pullRequest: PULL_REQUEST,
      files: [photoFile(added.photo, "added", PULL_REQUEST.branch)],
      albums: { folder: `${FOLDER}/albums`, files: [groupFile(added.album)] },
      tags: { folder: `${FOLDER}/tags`, files: [groupFile(added.tag)] },
      images: imagesByPath([added.photo]),
    },
    "GET /api/photos/in-flight/ci": {
      sha: PULL_REQUEST.headSha,
      state: "done",
      runUrl: `https://github.com/${REPO}/actions/runs/1`,
    },
    "GET /api/photos/published": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: BASE_BRANCH,
      pullRequest: PULL_REQUEST,
      files: basePhotos.map((file) => photoFile(file, "published")),
      images: imagesByPath(basePhotos),
    },
    "GET /api/photos/bucket": { bucket: "servenupphotos", images: bucketImages() },
    "GET /api/photos/bucket/thumbnail-crop": ({ url }) => {
      const key = url.searchParams.get("key") ?? "";
      const photo = headPhotos.find(({ data }) => data.images?.key === key);
      const crop = photo?.data.images?.thumbnailcrop;
      return { key, crop: crop ? { x: crop.x, y: crop.y, size: crop.size } : null };
    },
    "POST /api/photos/all-photos/check": {
      sources: [
        { label: `Pull request #${PULL_REQUEST.number}`, fileUrl: PULL_REQUEST.url, found: true },
      ],
      matches: [],
    },
    "GET /api/organize": {
      repo: REPO,
      folder: FOLDER,
      branch: BASE_BRANCH,
      pullRequest: PULL_REQUEST,
      albums: [...baseAlbums.map((f) => group(f, false)), group(added.album, true)],
      tags: [...baseTags.map((f) => group(f, false)), group(added.tag, true)],
    },
    "GET /api/publish/instagram": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: PULL_REQUEST.branch,
      pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
      photos: headPhotos.map(socialPhoto),
      unreadable: [],
    },
    // Saves answer as if they committed to the open pull request.
    "POST /api/photos/github": ({ body }) => savedPhoto(`${FOLDER}/photos/${body?.name}.json`),
    "PUT /api/photos/in-flight": ({ body }) => ({
      path: body?.path,
      fileUrl: fileUrl(body?.path ?? "", PULL_REQUEST.branch),
      commitSha: PULL_REQUEST.headSha,
      changed: true,
    }),
    "POST /api/photos/groups": ({ body }) => ({ ...commit(), files: body?.paths?.length }),
    "PUT /api/publish/instagram": ({ body }) => ({ ...commit(), files: body?.dates?.length }),
  };
}

/** Each R2 object's photo, by its key without the extension or version, for placeholder images. */
export function photoSizes() {
  return new Map(
    headPhotos
      .filter(({ data }) => imagesOf(data).key)
      .map(({ data }) => [
        data.images.key.replace(/^photos\/|\.jpe?g$/g, ""),
        { width: data.width, height: data.height },
      ]),
  );
}
