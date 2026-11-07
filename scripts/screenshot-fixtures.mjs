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
const baseGenres = readFolder("genres", "ALLGENRES");
const basePlaces = readFolder("places", "PLACES");
const baseLocalizations = readFolder("localizations", "LOCALIZATIONS");
const baseMetaInfo = readFolder("metainfo", "METAINFO");
const baseCameras = readFolder("cameras", "CAMERAS");
const baseLenses = readFolder("lenses", "LENSES");
const baseCaptions = readFolder("captions", "CAPTIONS");
const baseTimeline = readFolder("timeline", "TIMELINE");
const baseLikes = readFolder("likes", "LIKES");
const baseTripLines = readFolder("triplines", "TRIPLINES");

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
      // An adapted manual lens, which EXIF only knows by its focal length.
      camera: "X-T5",
      lens: "21.0 mm",
      focalLength: 21,
      aperture: null,
      exifOriginals: {},
      createDate: "2026:05:19 20:41:12",
      placeName: "Gyeongbokgung Palace",
      places: [
        { relation: "in", id: "gyeongbokgung-palace" },
        { relation: "by", id: "geunjeongmun-gate" },
      ],
      images: { ...images, key: `photos/${stem}.jpg` },
      albums: ["seoul"],
      tags: ["night"],
      genres: ["street"],
    },
  };
}

const added = {
  photo: newPhoto(),
  album: {
    path: `${FOLDER}/albums/seoul.json`,
    data: {
      id: "seoul",
      name: "Seoul",
      description: "Two weeks in Seoul.",
      parent: null,
      spotlightZones: ["homepage"],
      spotlightUpdated: { homepage: "2026-10-26" },
    },
  },
  tag: {
    path: `${FOLDER}/tags/night.json`,
    data: { id: "night", name: "Night", description: "" },
  },
  genres: [
    genreFile("street", "Street", "Candid photos of people and places in public."),
    genreFile("architecture", "Architecture", ""),
    genreFile("landscape", "Landscape", ""),
  ],
  places: [
    placeFile(
      "gyeongbokgung-palace",
      "Gyeongbokgung Palace",
      "The main royal palace of the Joseon dynasty.",
      { city: "Seoul", state: "Seoul", country: "South Korea" },
    ),
    placeFile("geunjeongmun-gate", "Geunjeongmun Gate", "", { parent: "gyeongbokgung-palace" }),
    placeFile("gwanghwamun-square", "Gwanghwamun Square", ""),
  ],
  localizations: [
    localizationFile("country", "south-korea", "South Korea", "Hanguk", "", "한국"),
    localizationFile(
      "place",
      "gyeongbokgung-palace",
      "Gyeongbokgung Palace",
      "Gyeongbokgung",
      "",
      "경복궁",
    ),
  ],
  cameras: [
    {
      path: `${FOLDER}/cameras/x-t5.json`,
      data: {
        id: "x-t5",
        camera: "X-T5",
        rules: [
          { when: null, set: { camera: "Fujifilm X-T5" } },
          {
            when: { field: "lens", value: "21.0 mm" },
            set: { lens: "7Artisans 21mm F1.4", aperture: 1.4 },
          },
        ],
      },
    },
  ],
  captions: [
    {
      path: `${FOLDER}/captions/instagram.json`,
      data: {
        id: "instagram",
        name: "Instagram",
        platform: "instagram",
        template: [
          "{title}",
          "",
          "{date}",
          "{camera}[, {lensShort} @ {focalLength}mm][, {exposure}sec][, ƒ {aperture}][, ISO {iso}]",
          "{places|cityLocalized}",
          "",
          "{comment}",
          "",
          "{hashtags}",
        ].join("\n"),
      },
    },
    {
      path: `${FOLDER}/captions/short.json`,
      data: { id: "short", name: "Short", platform: "", template: "{title} · {city}, {country}" },
    },
  ],
  lenses: [
    {
      path: `${FOLDER}/lenses/7artisans-12mm-f2-8.json`,
      data: {
        id: "7artisans-12mm-f2-8",
        name: "7Artisans 12mm F2.8",
        description: "Manual focus, adapted to the X-T5.",
        focalLength: 12,
        aperture: null,
        manualAperture: true,
      },
    },
  ],
  likes: [
    {
      path: `${FOLDER}/likes/jane.json`,
      data: {
        id: "jane",
        name: "Jane",
        photos: [271, 277, 281, 284, 286, 288],
        importedAt: "2026-11-01T18:20:00Z",
      },
    },
    {
      path: `${FOLDER}/likes/sam-k.json`,
      data: {
        id: "sam-k",
        name: "Sam K.",
        photos: [274, 281, 284, 289],
        importedAt: "2026-11-02T09:05:00Z",
      },
    },
    {
      path: `${FOLDER}/likes/mom.json`,
      data: { id: "mom", name: "Mom", photos: [281, 286, 287], importedAt: "2026-10-30T22:41:00Z" },
    },
  ],
  triplines: [
    {
      path: `${FOLDER}/triplines/2026-10-01.json`,
      data: {
        id: "2026-10-01",
        day: "2026-10-01",
        auto: false,
        segments: [
          {
            mode: "walk",
            start: { latitude: 34.6655, longitude: 135.5006, label: "Hotel" },
            photos: [302, 303, 304],
          },
          { mode: "subway", photos: [304, 305] },
          {
            mode: "walk",
            photos: [305, 306, 307],
            via: [{ after: 305, latitude: 34.6688, longitude: 135.5026, visit: 0 }],
          },
        ],
        visits: [
          {
            name: "Ichiran Dotonbori",
            kind: "restaurant",
            latitude: 34.6688,
            longitude: 135.5026,
            note: "Ramen before the river walk",
            link: "https://maps.app.goo.gl/example",
            after: 305,
          },
          { name: "Kuromon Market", kind: "shop", latitude: 34.6655, longitude: 135.5065 },
        ],
      },
    },
    {
      path: `${FOLDER}/triplines/2026-10-26.json`,
      data: { id: "2026-10-26", day: "2026-10-26", auto: true, segments: [] },
    },
  ],
  timeline: [
    {
      path: `${FOLDER}/timeline/japan-2026-09-22.json`,
      data: { id: "japan-2026-09-22", name: "Japan", start: "2026-09-22", end: "2026-10-02" },
    },
    {
      path: `${FOLDER}/timeline/korea-2026-09-20.json`,
      data: { id: "korea-2026-09-20", name: "Korea", start: "2026-09-20", end: "2026-09-21" },
    },
  ],
  metainfo: [
    metaGroupFile("focal-length-wide-angle", "Wide angle", "focalLength", {
      range: { min: 10, max: 24 },
    }),
    metaGroupFile("iso-high", "High ISO", "iso", { range: { min: 1600 } }),
    metaGroupFile("lens-brands", "Brands", "lens", { order: 1 }),
    metaGroupFile("lens-canon", "Canon", "lens", {
      parent: "lens-brands",
      values: [
        "EF-S10-18mm f/4.5-5.6 IS STM",
        "EF-S18-135mm f/3.5-5.6 IS STM",
        "EF-S18-135mm f/3.5-5.6 IS",
        "EF-S55-250mm f/4-5.6 IS STM",
        "EF50mm f/1.8 II",
      ],
    }),
    metaGroupFile("lens-fujifilm", "Fujifilm", "lens", {
      parent: "lens-brands",
      values: ["XF18-135mmF3.5-5.6R LM OIS WR"],
    }),
    metaGroupFile("lens-types", "Types", "lens", { order: 0 }),
    metaGroupFile("lens-zoom", "Zoom", "lens", {
      parent: "lens-types",
      values: ["EF-S18-135mm f/3.5-5.6 IS STM", "XF18-135mmF3.5-5.6R LM OIS WR"],
    }),
  ],
};

function metaGroupFile(id, name, field, { parent = "", order = 0, values = [], range } = {}) {
  return {
    path: `${FOLDER}/metainfo/${id}.json`,
    data: { id, name, description: "", field, parent, order, values, ...(range && { range }) },
  };
}

/** A photographic genre file the pull request adds. */
function genreFile(id, name, description) {
  return { path: `${FOLDER}/genres/${id}.json`, data: { id, name, description } };
}

function placeFile(
  id,
  name,
  description,
  { parent = "", city = "", state = "", country = "" } = {},
) {
  return {
    path: `${FOLDER}/places/${id}.json`,
    data: { id, name, description, parent, city, state, country },
  };
}

function localizationFile(type, slug, name, romanization, pronunciation, localScript) {
  const id = `${type}-${slug}`;
  return {
    path: `${FOLDER}/localizations/${id}.json`,
    data: { id, type, name, romanization, pronunciation, localScript },
  };
}

const headPhotos = [...basePhotos, added.photo];
const headAlbums = [...baseAlbums, added.album];
const headTags = [...baseTags, added.tag];
const headGenres = [...baseGenres, ...added.genres];
/** base with each of added's files in place of the base file at its path, or added at the end. */
function withAdded(base, addedFiles) {
  const paths = new Set(addedFiles.map((file) => file.path));
  return [...base.filter((file) => !paths.has(file.path)), ...addedFiles];
}

const headPlaces = withAdded(basePlaces, added.places);
const headLocalizations = withAdded(baseLocalizations, added.localizations);
const headMetaInfo = withAdded(baseMetaInfo, added.metainfo);
const headCameras = withAdded(baseCameras, added.cameras);
const headLenses = withAdded(baseLenses, added.lenses);
const headCaptions = withAdded(baseCaptions, added.captions);
const headTimeline = withAdded(baseTimeline, added.timeline);
const headLikes = withAdded(baseLikes, added.likes);
const headTripLines = withAdded(baseTripLines, added.triplines);

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

function combinedFiles(
  [
    photos,
    albums,
    tags,
    genres,
    places,
    localizations,
    metainfo,
    cameras,
    lenses,
    captions,
    timeline,
    likes,
    triplines,
  ],
  branch,
) {
  return {
    photos: combinedFile("photos", "ALLPHOTOS.json", photos, branch),
    albums: combinedFile("albums", "ALLALBUMS.json", albums, branch),
    tags: combinedFile("tags", "ALLTAGS.json", tags, branch),
    genres: combinedFile("genres", "ALLGENRES.json", genres, branch),
    places: combinedFile("places", "PLACES.json", places, branch),
    localizations: combinedFile("localizations", "LOCALIZATIONS.json", localizations, branch),
    metainfo: combinedFile("metainfo", "METAINFO.json", metainfo, branch),
    cameras: combinedFile("cameras", "CAMERAS.json", cameras, branch),
    lenses: combinedFile("lenses", "LENSES.json", lenses, branch),
    captions: combinedFile("captions", "CAPTIONS.json", captions, branch),
    timeline: combinedFile("timeline", "TIMELINE.json", timeline, branch),
    likes: combinedFile("likes", "LIKES.json", likes, branch),
    triplines: combinedFile("triplines", "TRIPLINES.json", triplines, branch),
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

/** The fields of data out of keys that are set, as the backend leaves empty ones out. */
const setFields = (data, keys) =>
  Object.fromEntries(keys.filter((key) => data[key]).map((key) => [key, data[key]]));

function group({ path: filePath, data }, inFlight) {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    ...setFields(data, [
      "parent",
      "order",
      "spotlightZones",
      "photoOrder",
      "covers",
      "layout",
      "favorite",
    ]),
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

/** What a save answers: its changes wait for Commit, which adds them to the open pull request. */
const HUE_BUCKETS = [
  "red",
  "orange",
  "yellow",
  "chartreuse",
  "green",
  "spring green",
  "cyan",
  "azure",
  "blue",
  "violet",
  "magenta",
  "rose",
];

/** A made-up color summary, as POST /api/data/colors/preview reads one, mostly in one hue bucket. */
function sampleColors(hex, bucket) {
  const neutral = 0.3;
  return {
    average: { hex, lab: { l: 52, a: 12, b: 20 }, hcl: { h: 59, c: 23, l: 52 } },
    buckets: HUE_BUCKETS.map((name, i) => ({
      name,
      hex: `hsl(${i * 30} 100% 50%)`,
      share: i === bucket ? 0.45 : (1 - neutral - 0.45) / 11,
    })),
    neutrals: {
      share: neutral,
      histogram: Array.from({ length: 20 }, (_, i) => ({
        from: i * 5,
        to: (i + 1) * 5,
        hex: `hsl(0 0% ${i * 5 + 2.5}%)`,
        share: neutral / 20,
      })),
    },
    lightness: 52,
    chroma: 23,
    peakChroma: 61,
    samples: 9984,
  };
}

/** Sample colors for the first photo files, with one whose original isn't in R2. */
function colorFiles() {
  const palette = [
    ["#8a6b4f", 1],
    ["#4f6f8a", 7],
    ["#6f8a4f", 4],
  ];
  const missing = { colors: null, error: "That photo isn't in the bucket anymore." };
  return headPhotos.slice(0, 4).map((photo, i) => ({
    path: photo.path,
    fileUrl: "",
    replaces: false,
    ...(palette[i] ? { colors: sampleColors(...palette[i]) } : missing),
  }));
}

/** A photo's GPS spot as [longitude, latitude], read from its "51 deg 24' 46.80\" N, …" position. */
function photoSpot(id) {
  const gps = headPhotos.find((p) => p.data.id === id)?.data.gpsPosition;
  const parts = gps?.match(/[\d.]+ deg [\d.]+' [\d.]+" [NSEW]/g) ?? [];
  const [lat, lng] = parts.map((part) => {
    const [d, m, sec] = part.match(/[\d.]+/g).map(Number);
    return (d + m / 60 + sec / 3600) * (/[SW]/.test(part) ? -1 : 1);
  });
  return lat === undefined ? undefined : [lng, lat];
}

/** The segment's via spots after a photo (or after its start, for undefined), as [longitude, latitude]. */
const viaSpots = (segment, after) =>
  (segment.via ?? []).filter((v) => v.after === after).map((v) => [v.longitude, v.latitude]);

/** A pretend street path through a segment's spots: each stretch turns one corner, like a city block. */
function blockPath(segment) {
  const spots = [
    segment.start && [segment.start.longitude, segment.start.latitude],
    ...viaSpots(segment, undefined),
    ...segment.photos.flatMap((id) => [photoSpot(id), ...viaSpots(segment, id)]),
    segment.end && [segment.end.longitude, segment.end.latitude],
  ].filter(Boolean);
  return spots.flatMap((spot, i) => (i === 0 ? [spot] : [[spot[0], spots[i - 1][1]], spot]));
}

/** The Snap to streets answer: every walk, bus or car segment gets a block-shaped path. */
const snapped = ({ body }) => ({
  line: {
    ...body,
    segments: body.segments.map((s) =>
      ["walk", "bus", "car"].includes(s.mode) ? { ...s, path: blockPath(s) } : s,
    ),
  },
  unrouted: 0,
});

/** A pretend track between ?from= and ?to=, bending out to one side like a line around a block. */
function curvedTrack({ url }) {
  const [from, to] = ["from", "to"].map((k) => url.searchParams.get(k).split(",").map(Number));
  const bend = [(from[0] + to[0]) / 2 + (to[1] - from[1]) * 0.3, (from[1] + to[1]) / 2];
  const steps = [0, 0.25, 0.5, 0.75, 1];
  const along = steps.map((t) => [
    (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * bend[0] + t ** 2 * to[0],
    (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * bend[1] + t ** 2 * to[1],
  ]);
  return { path: along };
}

/** Pretend stops along the line between photos 304 and 305, the last one a walk short of 305. */
function lineStops() {
  const [a, b] = [photoSpot(304), photoSpot(305)];
  const at = (t, dx = 0) => ({
    latitude: a[1] + (b[1] - a[1]) * t,
    longitude: a[0] + (b[0] - a[0]) * t + dx,
  });
  return [
    { name: "Namba", ...at(0.02, 0.0004) },
    { name: "Shinsaibashi", ...at(0.35, 0.002) },
    { name: "Yodoyabashi", ...at(0.65, 0.002) },
    { name: "Umeda", ...at(0.85, 0.0006) },
  ];
}

const pendingSave = (branch = PULL_REQUEST.branch) => ({
  branch,
  pullRequestUrl: PULL_REQUEST.url,
  pullRequestNumber: PULL_REQUEST.number,
  changes: [],
});

/** What adding albums, tags and genres to photos saves: each photo file before and after. */
function groupsAdded({ paths = [], ...add } = {}) {
  const changes = headPhotos
    .filter((file) => paths.includes(file.path))
    .map(({ path: filePath, data }) => ({
      path: filePath,
      before: data,
      after: withGroupsAdded(data, add),
    }));
  return { ...pendingSave(), changes, files: changes.length };
}

/** The photo's data with each album, tag and genre in add that it doesn't list yet. */
function withGroupsAdded(data, add) {
  const next = { ...data };
  for (const kind of ["albums", "tags", "genres"]) {
    next[kind] = [...new Set([...(data[kind] ?? []), ...(add[kind] ?? [])])];
  }
  return next;
}

/**
 * A photo as the Instagram calendar and the photo page's Spotlight card read it: the first is scheduled, every other
 * one eligible.
 */
function socialPhoto({ path: filePath, data }, i) {
  const images = imagesOf(data);
  const socialMediaPublishDate = i === 0 ? "2026-10-23" : null;
  return {
    path: filePath,
    fileUrl: fileUrl(filePath, PULL_REQUEST.branch),
    file: data.file,
    gpsPosition: data.gpsPosition,
    createDate: data.createDate,
    title: data.title,
    image: images.thumbnail ?? images.xsmall ?? null,
    isSocialMediaEligible: i % 2 === 0,
    socialMediaPublishDate,
    data: { ...data, socialMediaPublishDate },
  };
}

/** What saving a new photo JSON file answers: it waits for Commit, nothing on GitHub yet. */
const savedPhoto = (filePath, data) => ({
  path: filePath,
  pullRequestUrl: PULL_REQUEST.url,
  pullRequestNumber: PULL_REQUEST.number,
  data: data ?? {},
});

/**
 * What reading a JPEG's EXIF answers on the Photo page: the photo data pull request's own photo, as
 * if the JPEG were a re-edit of it, with its EXIF stripped the way an edited export often has it.
 */
function reEditExif(data) {
  const { width, height } = data;
  const fields = Object.fromEntries(Object.keys(data).map((key) => [key, null]));
  return {
    file: data.file,
    exif: { ImageWidth: width, ImageHeight: height },
    sanitized: { ...fields, width, height, images: {}, exifOriginals: null },
    colors: null,
  };
}

/** What uploading a JPEG to R2 answers: the photo at key, with every version next to it. */
function uploadAnswer(key) {
  const stem = key.replace(/\.jpe?g$/, "");
  const versions = Object.fromEntries(
    VERSIONS.map((name) => {
      const k = `${stem}-${name}.webp`;
      return [name, { key: k, url: `${CDN}/${k}` }];
    }),
  );
  return { key, url: `${CDN}/${key}`, versions };
}

/** Update Data's Image names preview: the first few titled photos, renamed after their titles. */
function imageNamesPreview() {
  const stem = (title) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  const files = headPhotos
    .filter(({ data }) => data.title && /^photos\/[0-9a-f]{12}-/.test(data.images?.key ?? ""))
    .slice(0, 6)
    .map(({ path, data }) => {
      const from = data.images.key;
      const to = `${from.slice(0, 20)}${stem(data.title)}.jpg`;
      const changes = Object.entries(data.images)
        .filter(([, v]) => typeof v === "string" && v.includes(from.replace(/\.jpg$/, "")))
        .map(([field, v]) => ({
          field: `images.${field}`,
          from: v,
          to: v.replace(from.replace(/\.jpg$/, ""), to.replace(/\.jpg$/, "")),
        }));
      return { path, fileUrl: "", title: data.title, from, to, changes };
    });
  return {
    repo: REPO,
    folder: `${FOLDER}/photos`,
    branch: PULL_REQUEST.branch,
    pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
    photoFiles: headPhotos.length,
    named: 3,
    untitled: headPhotos.filter(({ data }) => !data.title).length,
    elsewhere: 0,
    unreadable: [],
    files,
  };
}

/**
 * The photos Bulk Tagging picks: `count` of the pull request's photos, the first with no tags,
 * each saying what it shares with the first unless `any` picked them whatever they share.
 */
function bulkTagPick(count = 5, any = false) {
  const photos = headPhotos.slice(0, count).map(({ path, data }, i) => ({
    path,
    fileUrl: "",
    name: path
      .split("/")
      .pop()
      .replace(/\.json$/, ""),
    data,
    related: i === 0 || any ? [] : ["same city: kyoto", "taken the same day"].slice(0, (i % 2) + 1),
  }));
  return {
    branch: PULL_REQUEST.branch,
    pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
    photoFiles: headPhotos.length,
    untagged: 12,
    photos,
  };
}

/** What reading a pasted Bulk Tagging answer finds for the picked photos. */
function bulkTagsPreview() {
  const photos = bulkTagPick().photos.map(({ path, name }, i) => ({
    path,
    name,
    add: i === 0 ? ["shotengai", "lanterns"] : ["lanterns", "night"],
    already: i === 2 ? ["temple"] : [],
    skipped: i === 0 ? [{ name: "street", reason: "a genre has that name" }] : [],
  }));
  return {
    photos,
    newTags: [
      { id: "covered-street", description: "", parent: "", parentOnly: true },
      {
        id: "shotengai",
        description: "a Japanese shopping street, often under a covered arcade",
        parent: "covered-street",
        parentOnly: false,
      },
    ],
    unknown: [],
  };
}

/** A Tag pruning review: one change of each kind, and one the backend can't make. */
function pruneTagsPreview() {
  return {
    tags: 320,
    merge: [
      {
        tag: "lamppost",
        into: "lamps",
        reason: "a lamppost is a kind of lamp, and few photos tell them apart",
        photos: 4,
        children: [],
      },
    ],
    remove: [
      {
        tag: "details",
        reason: "too vague to gather photos that share anything",
        photos: 6,
        children: [],
      },
    ],
    reparent: [
      { tag: "torii", from: "", parent: "shrine", reason: "a torii is a shrine gate" },
      { tag: "chochin", from: "", parent: "lanterns", reason: "a Japanese paper lantern" },
    ],
    notes: [
      {
        photo: headPhotos[0].path
          .split("/")
          .pop()
          .replace(/\.json$/, ""),
        path: headPhotos[0].path,
        note: "Shows the details of a carved door; 'details' isn't a tag, since it's too vague.",
      },
    ],
    skipped: [{ change: "merge cats into animals", reason: '"cats" isn\'t a tag' }],
  };
}

/** The first of values that isn't missing, or "". */
const firstOr = (...values) => values.find((v) => typeof v === "string") ?? "";

/** list, or [] when it's missing. */
const listOr = (list) => list ?? [];

/** How many head photos list each tag. */
function headTagCounts() {
  const counts = new Map();
  for (const tag of headPhotos.flatMap(({ data }) => listOr(data.tags))) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}

/** One head photo as the Tag library exports it. */
const libraryPhoto = ({ path: filePath, data }) => ({
  photo: filePath
    .split("/")
    .pop()
    .replace(/\.json$/, ""),
  path: filePath,
  id: typeof data.id === "number" ? data.id : null,
  title: firstOr(data.title),
  city: firstOr(data.customCity, data.city),
  country: firstOr(data.customCountry, data.country),
  places: listOr(data.places).map((place) => place.id),
  genres: listOr(data.genres),
  albums: listOr(data.albums),
  tags: listOr(data.tags),
  notes: firstOr(data.notes),
});

/** Every tag and photo with its tags, as the Tag library reads them. */
function tagLibraryExport() {
  const counts = headTagCounts();
  const tags = headTags.map(({ data }) => ({
    tag: data.id,
    description: firstOr(data.description),
    parent: firstOr(data.parent),
    photos: counts.get(data.id) ?? 0,
  }));
  return {
    tags: tags.toSorted((x, y) => x.tag.localeCompare(y.tag)),
    photos: headPhotos.map(libraryPhoto),
    unreadable: [],
    minPhotos: 3,
  };
}

/** What a Tag library answer would do: one of each kind of change. */
function tagLibraryPreview() {
  const prune = pruneTagsPreview();
  const stem = (i) =>
    headPhotos[i].path
      .split("/")
      .pop()
      .replace(/\.json$/, "");
  const edit = (i, add, remove, reason) => ({
    photo: stem(i),
    path: headPhotos[i].path,
    add,
    remove,
    reason,
    tags: headPhotos[i].data.tags ?? [],
  });
  return {
    ...prune,
    photos: headPhotos.length,
    newTags: [
      {
        tag: "paper-lanterns",
        description: "lanterns made of paper, often hung outside shops",
        parent: "lanterns",
        reason: "4 photos show them",
      },
    ],
    rename: [
      {
        tag: "lamppost",
        to: "street-lights",
        reason: "matches how the others are named",
        photos: 4,
      },
    ],
    merge: [],
    describe: [{ tag: "shotengai", from: "", description: "a covered Japanese shopping street" }],
    edits: [
      edit(1, ["paper-lanterns"], ["details"], "paper lanterns hang over the street"),
      edit(2, ["street-lights"], [], "a row of lampposts lines the canal"),
    ],
    notes: [
      ...prune.notes,
      {
        photo: stem(3),
        path: headPhotos[3].path,
        note: "Has a koi pond; 'koi' wasn't made a tag, since only 2 photos have one.",
      },
    ],
    fewPhotos: [
      { tag: "chochin", photos: 2, parent: "lanterns", photoNames: [stem(1), stem(3)] },
      { tag: "torii", photos: 1, parent: "shrine", photoNames: [stem(2)] },
    ],
    minPhotos: 3,
    skipped: [
      {
        change: "make temple",
        reason: 'The tag "temple" already has the ID "temple". Pick another ID',
      },
    ],
  };
}

/** Up to `count` photos without genres that Genre Suggestions picked. */
function genrePick(count = 50) {
  const pick = bulkTagPick(Math.min(count, 6));
  return {
    ...pick,
    withoutGenres: 18,
    photos: pick.photos.map((photo) => ({ ...photo, related: [] })),
  };
}

/** What reading a pasted Genre Suggestions answer finds for the picked photos. */
function genreSuggestionsPreview() {
  const photos = genrePick().photos.map(({ path, name }, i) => ({
    path,
    name,
    add: [["street", "night"], ["architecture"], ["street"], ["macro"], ["night"], ["street"]][i],
    already: [],
    skipped: i === 1 ? [{ name: "temple", reason: "a tag has that name" }] : [],
  }));
  return {
    photos,
    newGenres: [
      {
        id: "night",
        name: "Night",
        description: "Photos taken after dark, lit by streetlights, signs or the moon.",
      },
    ],
    unknown: [],
  };
}

/** The photos the Alt Text page picks: Bulk Tagging's pick, as photos without alt text. */
function altTextPick(count = 20) {
  const { untagged: _untagged, ...pick } = bulkTagPick(Math.min(count, 4));
  return {
    ...pick,
    withoutAltText: 31,
    photos: pick.photos.map((photo) => ({ ...photo, related: [] })),
  };
}

/** What reading a pasted Alt Text answer finds for the picked photos. */
function altTextPreview() {
  const texts = [
    "A paper lantern glowing over a narrow alley at night, its light on wet stones.",
    "Two cats asleep on a sunlit stone wall, one curled around the other.",
    "",
    "Crowds crossing a wide intersection under tall neon signs on a rainy evening, umbrellas open everywhere you look, the lights reflected in the puddles.",
  ];
  return {
    photos: altTextPick().photos.map(({ path, name }, i) => ({
      path,
      name,
      altText: texts[i] ?? "",
      current: i === 1 ? "Cats on a wall." : "",
    })),
    unknown: [],
  };
}

/** The photos Album Suggestions picks: Bulk Tagging's pick, as photos without an album. */
function albumPick(count = 5) {
  const { untagged, photos, ...rest } = bulkTagPick(count);
  const related = ["same tag: lanterns", "same city: kyoto", "taken the same day"];
  return {
    ...rest,
    withoutAlbum: untagged + 7,
    photos: photos.map((photo, i) => ({ ...photo, related: i === 0 ? [] : related.slice(i % 2) })),
  };
}

/** What reading a pasted Album Suggestions answer finds for the picked photos. */
function albumSuggestionsPreview() {
  const paths = albumPick().photos.map((photo) => photo.path);
  return {
    albums: [
      {
        id: "kyoto-lantern-nights",
        name: "Kyoto Lantern Nights",
        description: "Lanterns and lit-up streets after dark in Kyoto.",
        parent: "test",
        new: true,
        photos: paths.slice(0, 3),
        reason: "",
      },
      {
        id: "homepage-spotlight",
        name: "Homepage Spotlight",
        description: "",
        parent: "",
        new: false,
        photos: paths.slice(3),
        reason: "",
      },
      {
        id: "",
        name: "Street",
        description: "",
        parent: "",
        new: false,
        photos: [],
        reason: "a genre has that name",
      },
    ],
    unknown: [],
  };
}

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
      github: {
        repo: REPO,
        branch: BASE_BRANCH,
        folder: "",
        token: secret,
        includeUntitled: false,
      },
    },
    "POST /api/settings/r2/test": { ok: true, message: "Connected to bucket servenupphotos." },
    "POST /api/settings/github/test": { ok: true, message: `Connected to ${REPO}.` },
    "GET /api/photos/combined": {
      repo: REPO,
      folder: FOLDER,
      base: {
        ...combinedFiles([
          basePhotos,
          baseAlbums,
          baseTags,
          baseGenres,
          basePlaces,
          baseLocalizations,
          baseMetaInfo,
          baseCameras,
          baseLenses,
          baseCaptions,
          baseTimeline,
          baseLikes,
          baseTripLines,
        ]),
        branch: BASE_BRANCH,
      },
      head: {
        ...combinedFiles(
          [
            headPhotos,
            headAlbums,
            headTags,
            headGenres,
            headPlaces,
            headLocalizations,
            headMetaInfo,
            headCameras,
            headLenses,
            headCaptions,
            headTimeline,
            headLikes,
            headTripLines,
          ],
          PULL_REQUEST.branch,
        ),
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
      genres: { folder: `${FOLDER}/genres`, files: added.genres.map(groupFile) },
      places: { folder: `${FOLDER}/places`, files: added.places.map(groupFile) },
      localizations: {
        folder: `${FOLDER}/localizations`,
        files: added.localizations.map(groupFile),
      },
      metainfo: { folder: `${FOLDER}/metainfo`, files: added.metainfo.map(groupFile) },
      cameras: { folder: `${FOLDER}/cameras`, files: added.cameras.map(groupFile) },
      lenses: { folder: `${FOLDER}/lenses`, files: added.lenses.map(groupFile) },
      captions: { folder: `${FOLDER}/captions`, files: added.captions.map(groupFile) },
      timeline: { folder: `${FOLDER}/timeline`, files: added.timeline.map(groupFile) },
      likes: { folder: `${FOLDER}/likes`, files: added.likes.map(groupFile) },
      triplines: { folder: `${FOLDER}/triplines`, files: added.triplines.map(groupFile) },
      images: imagesByPath([added.photo]),
    },
    "GET /api/photos/combined/status": { state: "synced", headSha: PULL_REQUEST.headSha },
    "GET /api/photos/published": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: BASE_BRANCH,
      pullRequest: PULL_REQUEST,
      files: basePhotos.map((file) => photoFile(file, "published")),
      images: imagesByPath(basePhotos),
    },
    "GET /api/photos/bucket": { bucket: "servenupphotos", images: bucketImages() },
    "POST /api/photos/bucket/delete": ({ body }) => ({ deleted: body.keys, failed: [] }),
    "GET /api/photos/bucket/thumbnail-crop": ({ url }) => {
      const key = url.searchParams.get("key") ?? "";
      const photo = headPhotos.find(({ data }) => data.images?.key === key);
      const crop = photo?.data.images?.thumbnailcrop;
      return { key, crop: crop ? { x: crop.x, y: crop.y, size: crop.size } : null };
    },
    "POST /api/data/camera-overrides/preview": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: PULL_REQUEST.branch,
      pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
      photoFiles: headPhotos.length,
      overrides: added.cameras.length,
      unreadable: [],
      files: [
        {
          path: added.photo.path,
          fileUrl: "",
          camera: "X-T5",
          changes: [
            { field: "camera", from: "X-T5", to: "Fujifilm X-T5" },
            { field: "lens", from: "21.0 mm", to: "7Artisans 21mm F1.4" },
            { field: "aperture", from: null, to: 1.4 },
            {
              field: "exifOriginals",
              from: {},
              to: { aperture: null, camera: "X-T5", lens: "21.0 mm" },
            },
          ],
        },
      ],
    },
    "POST /api/data/camera-overrides": () => ({ ...pendingSave(), files: 1, fields: 4 }),
    "POST /api/data/location-names/preview": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: PULL_REQUEST.branch,
      pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
      photoFiles: headPhotos.length,
      placeFiles: headPlaces.length,
      otherNames: 1,
      unreadable: [],
      files: headPhotos
        .filter(({ data }) => data.country === "United States")
        .map(({ path }) => ({
          path,
          fileUrl: "",
          kind: "photo",
          changes: [{ field: "country", from: "United States", to: "United States of America" }],
        })),
    },
    "POST /api/data/location-names": () => ({ ...pendingSave(), files: 9, fields: 9 }),
    "POST /api/data/image-names/preview": () => imageNamesPreview(),
    "POST /api/data/image-names": () => ({ ...pendingSave(), files: 6, fields: 66 }),
    "POST /api/data/bulk-tags/untagged": () => ({ ...bulkTagPick(), photos: [] }),
    "POST /api/data/bulk-tags/pick": ({ body }) => bulkTagPick(body?.count, body?.any),
    "POST /api/data/bulk-tags/preview": () => bulkTagsPreview(),
    "POST /api/data/bulk-tags": () => ({ ...pendingSave(), newTags: 2, photos: 5 }),
    "POST /api/data/bulk-places/pick": ({ body }) => {
      const { untagged, ...pick } = bulkTagPick(body?.count);
      return { ...pick, unplaced: untagged };
    },
    "POST /api/data/bulk-places": () => ({ ...pendingSave(), newPlaces: 1, photos: 4 }),
    "POST /api/data/prune-tags/preview": () => pruneTagsPreview(),
    "POST /api/data/prune-tags": () => ({
      ...pendingSave(),
      deleted: 2,
      reparented: 2,
      photos: 10,
    }),
    "POST /api/data/tag-library/export": () => tagLibraryExport(),
    "POST /api/data/tag-library/preview": () => tagLibraryPreview(),
    "POST /api/data/tag-library": () => ({
      ...pendingSave(),
      made: 2,
      deleted: 2,
      edited: 3,
      photos: 12,
    }),
    "POST /api/data/genre-suggestions/pick": ({ body }) => genrePick(body?.count),
    "POST /api/data/genre-suggestions/preview": () => genreSuggestionsPreview(),
    "POST /api/data/genre-suggestions": () => ({ ...pendingSave(), newGenres: 1, photos: 6 }),
    "POST /api/data/alt-text/pick": ({ body }) => altTextPick(body?.count),
    "POST /api/data/alt-text/preview": () => altTextPreview(),
    "POST /api/data/alt-text": () => ({ ...pendingSave(), photos: 3 }),
    "POST /api/data/album-suggestions/pick": ({ body }) => albumPick(body?.count),
    "POST /api/data/album-suggestions/preview": () => albumSuggestionsPreview(),
    "POST /api/data/album-suggestions": () => ({ ...pendingSave(), newAlbums: 1, photos: 5 }),
    "POST /api/data/related-photos": () => ({ ...pendingSave(), photoFiles: 368, photos: 361 }),
    "PUT /api/data/related-photos/picked": () => pendingSave(),
    "POST /api/data/colors/preview": ({ body }) => ({
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: PULL_REQUEST.branch,
      pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
      photoFiles: headPhotos.length,
      haveColors: headPhotos.length - 4,
      recompute: Boolean(body?.recompute),
      unreadable: [],
      files: colorFiles(),
    }),
    "POST /api/data/colors": () => ({ ...pendingSave(), files: 3, failed: 1 }),
    "POST /api/data/near-duplicates": () => ({
      ...pendingSave(),
      photos: 120,
      hashed: 118,
      hashFailed: 2,
      groups: [
        {
          group: "Near duplicates of Lantern street",
          paths: [`${FOLDER}/photos/lantern-street.json`, `${FOLDER}/photos/DSCF4801.json`],
        },
      ],
    }),
    // No read running: the page shows its own label until a read reports how far it has got.
    "GET /api/data/progress/colors": { running: false, step: "", done: 0, total: 0 },
    "GET /api/data/progress/missing-fields": { running: false, step: "", done: 0, total: 0 },
    "PUT /api/localizations/country-united-states-of-america": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/localizations/country-united-states-of-america.json`,
      data: body,
      before: null,
      changed: true,
    }),
    "PUT /api/cameras/x-t5": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/cameras/x-t5.json`,
      data: body,
      before: added.cameras[0].data,
      changed: true,
    }),
    "PUT /api/captions/instagram": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/captions/instagram.json`,
      data: body,
      before: added.captions[0].data,
      changed: true,
    }),
    "PUT /api/lenses/7artisans-12mm-f2-8": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/lenses/7artisans-12mm-f2-8.json`,
      data: body,
      before: added.lenses[0].data,
      changed: true,
    }),
    "PUT /api/likes/jane": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/likes/jane.json`,
      data: { ...body, importedAt: "2026-11-03T03:32:11Z" },
      before: added.likes[0].data,
      changed: true,
    }),
    "GET /api/triplines/2026-10-26/auto": {
      id: "2026-10-26",
      day: "2026-10-26",
      auto: false,
      segments: [
        { mode: "walk", photos: [409, 410, 412, 414, 416] },
        { mode: "walk", photos: [444, 445] },
      ],
    },
    "GET /api/triplines/2026-11-01/auto": {
      id: "2026-11-01",
      day: "2026-11-01",
      auto: false,
      segments: [
        { mode: "walk", photos: [481, 482, 485, 486, 488, 469, 470, 475] },
        { mode: "transit", photos: [475, 495] },
        { mode: "walk", photos: [495, 496, 497, 471] },
      ],
    },
    "POST /api/triplines/2026-10-01/route": snapped,
    "GET /api/transit/lines": [
      {
        id: 1,
        name: "Midosuji Line",
        ref: "M",
        colour: "#e5171f",
        kind: "subway",
        from: "Nakamozu",
        to: "Esaka",
      },
      {
        id: 2,
        name: "Midosuji Line",
        ref: "M",
        colour: "#e5171f",
        kind: "subway",
        from: "Esaka",
        to: "Nakamozu",
      },
    ],
    "GET /api/transit/lines/1/stops": lineStops,
    "GET /api/transit/lines/1/track": curvedTrack,
    "PUT /api/triplines/2026-10-01": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/triplines/2026-10-01.json`,
      data: body,
      before: added.triplines[0].data,
      changed: true,
    }),
    "PUT /api/timeline/japan-2026-09-22": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/timeline/japan-2026-09-22.json`,
      data: body,
      before: added.timeline[0].data,
      changed: true,
    }),
    "POST /api/photos/bucket/exif": {
      file: "DSCF3104.jpg",
      exif: {
        Make: "FUJIFILM",
        Model: "X-T5",
        LensMake: "7Artisans",
        LensModel: "",
        Lens: "21.0 mm",
        LensInfo: "21mm f/?",
        FocalLength: "21.0 mm",
        FocalLengthIn35mmFormat: "32 mm",
        FNumber: 0,
        ExposureTime: "1/250",
        ISO: 400,
        SerialNumber: "5CA12345",
      },
      sanitized: null,
      colors: null,
    },
    "POST /api/exif": () => reEditExif(added.photo.data),
    "POST /api/upload": uploadAnswer("photos/0a1b2c3d4e5f-dscf3104.jpg"),
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
      genres: [
        ...baseGenres.map((f) => group(f, false)),
        ...added.genres.map((f) => group(f, true)),
      ],
    },
    "GET /api/places": {
      repo: REPO,
      folder: FOLDER,
      branch: PULL_REQUEST.branch,
      pullRequest: PULL_REQUEST,
      places: headPlaces,
      localizations: headLocalizations,
    },
    "GET /api/publish/instagram": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: PULL_REQUEST.branch,
      pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
      photos: headPhotos.map(socialPhoto),
      unreadable: [],
    },
    // Saves answer as the backend does: their changes wait for Commit, for the open pull request.
    "POST /api/photos/github": ({ body }) => savedPhoto(`${FOLDER}/photos/${body?.name}.json`),
    "POST /api/organize/tags": ({ body = {} }) =>
      savedPhoto(`${FOLDER}/tags/${body.id}.json`, { ...body, description: "" }),
    "POST /api/organize/genres": ({ body = {} }) =>
      savedPhoto(`${FOLDER}/genres/${body.id}.json`, { ...body, description: "" }),
    "PUT /api/photos/in-flight": ({ body = {} }) => ({
      path: savedPath(body),
      changed: true,
      pullRequestUrl: PULL_REQUEST.url,
      before: null,
      data: body.data ?? {},
    }),
    "PUT /api/organize/albums/order": ({ body }) => ({
      ...pendingSave(),
      files: body?.ids?.length,
    }),
    "PUT /api/organize/albums/homepage-spotlight/photo-order": { ...pendingSave(), files: 1 },
    "PUT /api/organize/albums/homepage-spotlight/layout": { ...pendingSave(), files: 1 },
    "DELETE /api/organize/albums/homepage-spotlight": {
      ...pendingSave(),
      photos: 10,
      reparented: 0,
    },
    "DELETE /api/organize/albums/homepage-spotlight/photos": ({ body }) => ({
      ...pendingSave(),
      photos: body?.photoIds?.length ?? 0,
    }),
    "DELETE /api/organize/albums/japan/photos": ({ body }) => ({
      ...pendingSave(),
      photos: body?.photoIds?.length ?? 0,
    }),
    "PUT /api/organize/albums/homepage-spotlight/visibility": { ...pendingSave(), files: 1 },
    "PUT /api/organize/albums/japan/rules": { ...pendingSave(), files: 1 },
    "PUT /api/organize/tags/names": { ...pendingSave(), files: 1 },
    "PUT /api/organize/tags/descriptions": ({ body }) => ({
      ...pendingSave(),
      files: Object.keys(body?.descriptions ?? {}).length,
    }),
    "PUT /api/organize/tags/favorites": ({ body }) => ({
      ...pendingSave(),
      files: Object.keys(body?.favorites ?? {}).length,
    }),
    "PUT /api/organize/spotlight/homepage": { ...pendingSave(), files: 2 },
    "POST /api/photos/groups": ({ body }) => groupsAdded(body),
    "DELETE /api/photos/pending": { discarded: 1 },
    "GET /api/photos/pending": {
      version: 1,
      repo: REPO,
      exported: "2026-10-30T06:44:08Z",
      files: [],
    },
    "POST /api/photos/pending": ({ body }) => ({
      restored: body?.files?.length ?? 0,
      unchanged: 0,
    }),
    "POST /api/photos/combined": () => ({
      changed: true,
      commitSha: "c0mb1ned",
      commitUrl: `https://github.com/${REPO}/commit/c0mb1ned`,
      files: [`${FOLDER}/photos/ALLPHOTOS.json`],
      edited: 0,
      counts: { photos: basePhotos.length + 1, albums: 1, tags: 1 },
      newPullRequest: false,
      pullRequestUrl: PULL_REQUEST.url,
      skipped: [],
    }),
    "PUT /api/publish/instagram": ({ body }) => ({ ...pendingSave(), files: body?.dates?.length }),
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

/** Where a photo editor save puts the file: moved to `name` in its folder when that's given. */
function savedPath({ path, name }) {
  return name ? path.replace(/[^/]+$/, `${name}.json`) : path;
}
