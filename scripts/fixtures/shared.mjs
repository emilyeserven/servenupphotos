// What every area's sample answers share: the committed portfolio data, the one open "Add photo
// data" pull request that adds a photo, an album and a tag, and the builders for their files.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "../..");

export const FOLDER = "apps/portfolio/src/data";

export const REPO = "emilyeserven/servenupphotos";

export const BASE_BRANCH = "main";

export const CDN = "https://cdn.servenupphotos.net";

export const PULL_REQUEST = {
  number: 90,
  title: "Add photo data",
  url: `https://github.com/${REPO}/pull/90`,
  branch: "photo-data/2026-10-22-120000",
  headSha: "f1x7ur3000000000000000000000000000000000",
};

export const fileUrl = (filePath, branch = BASE_BRANCH) =>
  `https://github.com/${REPO}/blob/${branch}/${filePath}`;

/** Every JSON file in a data folder except the combined one, as { path, data }. */
export function readFolder(kind, combined) {
  const dir = path.join(root, FOLDER, kind);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") && !name.startsWith(combined))
    .toSorted()
    .map((name) => ({
      path: `${FOLDER}/${kind}/${name}`,
      data: JSON.parse(readFileSync(path.join(dir, name), "utf8")),
    }));
}

export const basePhotos = readFolder("photos", "ALLPHOTOS");

export const baseAlbums = readFolder("albums", "ALLALBUMS");

export const baseTags = readFolder("tags", "ALLTAGS");

export const baseGenres = readFolder("genres", "ALLGENRES");

export const basePlaces = readFolder("places", "PLACES");

export const baseLocalizations = readFolder("localizations", "LOCALIZATIONS");

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

/** A graph preset file the pull request adds, in a group, with the rest of its graph's settings as the Graph page starts them. */
function graphPresetFile(id, name, order, group, graph) {
  const settings = { measure: "count", y: "", split: "", stacked: false, sort: "group", limit: 0 };
  return {
    path: `${FOLDER}/graphs/${id}.json`,
    data: { id, kind: "preset", name, order, group, graph: { ...settings, ...graph } },
  };
}

export const added = {
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
      path: `${FOLDER}/triplines/story-2026-10-01.json`,
      data: {
        id: "story-2026-10-01",
        date: "2026-10-01",
        intro:
          "Our first afternoon in **Osaka**, straight from the airport to the covered arcades.",
        photos: [
          { id: 302, text: "The arcade roof kept the drizzle off", withNext: true },
          { id: 303, text: "Lanterns for the *autumn* festival" },
          {
            id: 304,
            text: "Off the main arcade the streets got **narrow** and quiet, with bikes parked two deep outside every shop.",
            textSide: "left",
            after: "A short subway ride later we crossed the river just as the signs came on.",
          },
          { id: 305, withNext: true },
          { id: 306, text: "Quieter streets one block back", withNext: true },
          { id: 307, text: "Dotonbori at night" },
        ],
      },
    },
    {
      path: `${FOLDER}/triplines/2026-10-26.json`,
      data: {
        id: "2026-10-26",
        day: "2026-10-26",
        auto: true,
        // As the backend saves it: the automatic line as last worked out.
        segments: [
          { mode: "walk", photos: [409, 410, 412, 414, 416] },
          { mode: "walk", photos: [444, 445] },
        ],
      },
    },
  ],
  gear: [
    {
      path: `${FOLDER}/gear/camera-fujifilm-x-t5.json`,
      data: {
        id: "camera-fujifilm-x-t5",
        kind: "camera",
        name: "Fujifilm X-T5",
        image: "https://cdn.servenupphotos.net/gear/0a1b2c3d4e5f-x-t5.webp",
        original: "https://cdn.servenupphotos.net/gear/originals/9a8b7c6d5e4f-x-t5.jpg",
        crop: { x: 0.05, y: -0.1, width: 0.9, height: 1.35 },
        subject: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        description: "My everyday camera since 2024.",
      },
    },
    {
      path: `${FOLDER}/gear/camera-fujifilm-x100v.json`,
      data: {
        id: "camera-fujifilm-x100v",
        kind: "camera",
        name: "Fujifilm X100V",
        image: "https://cdn.servenupphotos.net/gear/1b2c3d4e5f6a-x100v.webp",
        original: "https://cdn.servenupphotos.net/gear/originals/8b7c6d5e4f3a-x100v.jpg",
        crop: { x: -0.1, y: -0.2, width: 1.2, height: 1.8 },
        description: "",
      },
    },
  ],
  graphs: [
    {
      path: `${FOLDER}/graphs/when.json`,
      data: { id: "when", kind: "group", name: "When", order: 5 },
    },
    graphPresetFile("seasons-by-year", "Seasons by year", 1, "when", {
      type: "bar",
      x: "year",
      split: "season",
      stacked: true,
      sort: "reverse",
    }),
    graphPresetFile("time-of-day", "Time of day", 2, "when", { type: "pie", x: "daypart" }),
  ],
  timeline: [
    {
      path: `${FOLDER}/timeline/japan-2026-09-22.json`,
      data: {
        id: "japan-2026-09-22",
        name: "Japan",
        start: "2026-09-22",
        end: "2026-10-02",
        legs: [
          {
            mode: "flight",
            from: {
              day: "2026-09-22",
              spot: { latitude: 40.6413, longitude: -73.7781, label: "JFK" },
            },
            to: { day: "2026-10-01" },
          },
          {
            mode: "train",
            from: {
              day: "2026-09-23",
              spot: { latitude: 33.9494, longitude: 130.9218, label: "Shimonoseki" },
            },
            to: {
              day: "2026-09-23",
              spot: { latitude: 34.417, longitude: 131.4105, label: "Higashi-Hagi" },
            },
            rides: [
              {
                change: { latitude: 34.37, longitude: 131.18, label: "Nagato-shi" },
                line: { id: 1, name: "San'in Line", colour: "#00a3d9" },
                path: [
                  [130.9218, 33.9494],
                  [131.0, 34.2],
                  [131.18, 34.37],
                ],
              },
              {
                line: { id: 2, name: "San'in Line", colour: "#00a3d9" },
                path: [
                  [131.18, 34.37],
                  [131.3, 34.4],
                  [131.4105, 34.417],
                ],
              },
            ],
          },
          {
            mode: "ferry",
            from: { day: "2026-10-01" },
            to: {
              day: "2026-10-02",
              spot: { latitude: 35.1028, longitude: 129.0403, label: "Busan Port" },
            },
          },
        ],
      },
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

export const headPhotos = [...basePhotos, added.photo];

export const headTags = [...baseTags, added.tag];

/** base with each of added's files in place of the base file at its path, or added at the end. */
export function withAdded(base, addedFiles) {
  const paths = new Set(addedFiles.map((file) => file.path));
  return [...base.filter((file) => !paths.has(file.path)), ...addedFiles];
}

export const headPlaces = withAdded(basePlaces, added.places);

export const headLocalizations = withAdded(baseLocalizations, added.localizations);

/** A photo's `images`, or an empty object for a photo saved before it was uploaded. */
export const imagesOf = (data) => data.images ?? {};

/** The fields of data out of keys that are set, as the backend leaves empty ones out. */
const setFields = (data, keys) =>
  Object.fromEntries(keys.filter((key) => data[key]).map((key) => [key, data[key]]));

export function group({ path: filePath, data }, inFlight) {
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

export const VERSIONS = [
  "xlarge",
  "large",
  "medium",
  "small",
  "xsmall",
  "preview",
  "thumbnail",
  "thumbnailpreview",
];

export const pendingSave = (branch = PULL_REQUEST.branch) => ({
  branch,
  pullRequestUrl: PULL_REQUEST.url,
  pullRequestNumber: PULL_REQUEST.number,
  changes: [],
});

/** What saving a new photo JSON file answers: it waits for Commit, nothing on GitHub yet. */
export const savedPhoto = (filePath, data) => ({
  path: filePath,
  pullRequestUrl: PULL_REQUEST.url,
  pullRequestNumber: PULL_REQUEST.number,
  data: data ?? {},
});
