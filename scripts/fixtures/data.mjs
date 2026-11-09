// Sample answers for the routes in routes_data.go.
import {
  CDN,
  FOLDER,
  PULL_REQUEST,
  REPO,
  added,
  headPhotos,
  headPlaces,
  pendingSave,
} from "./shared.mjs";
import {
  albumPick,
  albumSuggestionsPreview,
  altTextPick,
  altTextPreview,
  bulkTagPick,
  bulkTagsPreview,
  colorFiles,
  genrePick,
  genreSuggestionsPreview,
  imageNamesPreview,
  pruneTagsPreview,
  r2ExifPhotos,
  scannedPhotos,
  tagLibraryExport,
  tagLibraryPreview,
} from "./data-helpers.mjs";

/** The sample answers for the data routes, keyed "METHOD /api/path". */
export function dataFixtures() {
  return {
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
    "POST /api/data/r2-exif/preview": () => ({
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: PULL_REQUEST.branch,
      pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
      photoFiles: headPhotos.length,
      checked: headPhotos.length,
      unreadable: [],
      photos: r2ExifPhotos(),
    }),
    "POST /api/data/r2-exif/write": ({ body }) => ({
      ...pendingSave(),
      edits: [
        {
          date: "2026-11-07T15:30:00Z",
          fields: (body?.fields ?? []).map((f) => ({ field: f.field, from: null, to: f.value })),
        },
      ],
    }),
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
    "GET /api/data/progress/r2-exif": { running: false, step: "", done: 0, total: 0 },
    "GET /api/data/progress/missing-fields": { running: false, step: "", done: 0, total: 0 },
    "POST /api/data/image-base-url/preview": () => ({
      ...scannedPhotos(),
      from: "",
      to: "",
      origins: [{ origin: CDN, urls: headPhotos.length * 4, files: headPhotos.length }],
      files: [],
      urls: 0,
    }),
    "POST /api/data/image-base-url": () => ({ ...pendingSave(), files: 3, urls: 12 }),
    "POST /api/data/missing-fields/preview": () => ({
      ...scannedPhotos(),
      fields: [],
      files: [],
      readExif: false,
    }),
    "POST /api/data/missing-fields": () => ({ ...pendingSave(), files: 2, fields: 5 }),
  };
}
