// Builders for the sample previews and picks that the data routes' answers use.
import { FOLDER, PULL_REQUEST, REPO, headPhotos, headTags } from "./shared.mjs";

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
export function colorFiles() {
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

/**
 * Photos whose originals don't match their photo files, as POST /api/data/r2-exif/preview finds
 * them: a time fixed across timezones, a lens renamed by a camera override, and one written before.
 */
export function r2ExifPhotos() {
  const [fixed, renamed, edited] = headPhotos.slice(0, 3).map(({ path, data }) => ({
    path,
    fileUrl: "",
    key: data.images.key,
    title: data.title,
    thumbnail: data.images.thumbnail,
    mismatches: [],
    edits: [],
  }));
  fixed.mismatches = [
    {
      field: "createDate",
      photo: "2016:12:24 06:07:39",
      r2: "2016:12:23 22:07:39",
      source: "custom",
    },
    { field: "city", photo: "Seoul", r2: null, source: "custom" },
  ];
  renamed.mismatches = [
    { field: "lens", photo: "Color Skopar 21mm F4", r2: "21.0 mm", source: "override" },
  ];
  edited.edits = [
    {
      date: "2026-11-02T10:15:00Z",
      fields: [
        {
          field: "createDate",
          from: "2016:12:16 01:27:41",
          to: "2016:12:16 09:27:41",
        },
        { field: "country", from: null, to: "Netherlands" },
      ],
    },
  ];
  return [fixed, renamed, edited];
}

/** Update Data's Image names preview: the first few titled photos, renamed after their titles. */
export function imageNamesPreview() {
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
export function bulkTagPick(count = 5, any = false) {
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
export function bulkTagsPreview() {
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
export function pruneTagsPreview() {
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
export function tagLibraryExport() {
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
export function tagLibraryPreview() {
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
export function genrePick(count = 50) {
  const pick = bulkTagPick(Math.min(count, 6));
  return {
    ...pick,
    withoutGenres: 18,
    photos: pick.photos.map((photo) => ({ ...photo, related: [] })),
  };
}

/** What reading a pasted Genre Suggestions answer finds for the picked photos. */
export function genreSuggestionsPreview() {
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
export function altTextPick(count = 20) {
  const { untagged: _untagged, ...pick } = bulkTagPick(Math.min(count, 4));
  return {
    ...pick,
    withoutAltText: 31,
    photos: pick.photos.map((photo) => ({ ...photo, related: [] })),
  };
}

/** What reading a pasted Alt Text answer finds for the picked photos. */
export function altTextPreview() {
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
export function albumPick(count = 5) {
  const { untagged, photos, ...rest } = bulkTagPick(count);
  const related = ["same tag: lanterns", "same city: kyoto", "taken the same day"];
  return {
    ...rest,
    withoutAlbum: untagged + 7,
    photos: photos.map((photo, i) => ({ ...photo, related: i === 0 ? [] : related.slice(i % 2) })),
  };
}

/** What reading a pasted Album Suggestions answer finds for the picked photos. */
export function albumSuggestionsPreview() {
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

/** What an Update Data preview says about the photo files it read, before its own fields. */
export function scannedPhotos() {
  return {
    repo: REPO,
    folder: `${FOLDER}/photos`,
    branch: PULL_REQUEST.branch,
    pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
    photoFiles: headPhotos.length,
    unreadable: [],
  };
}
