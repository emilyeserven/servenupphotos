import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { publicOriginal } from "./src/lib/unedited-original";

/** The combined photo lists the portfolio imports: ALLPHOTOS.json and ALLPHOTOS.local.json. */
const ALL_PHOTOS = /[/\\]ALLPHOTOS(\.local)?\.json$/;

/**
 * The photo fields only the pipeline uses, which the pipeline writes: the photographer-only notes,
 * and the edits made to each original's EXIF in R2.
 */
const PRIVATE_KEYS = ["notes", "r2ExifEdits"];

/**
 * A photo with its pipeline-only fields taken off, and its unedited original too unless it's shown
 * on the portfolio, when only its size and resized versions are kept.
 */
function withoutPrivate(photo: object): object {
  const kept = Object.entries(photo).filter(
    ([key]) => !PRIVATE_KEYS.includes(key) && key !== "original",
  );
  const original = publicOriginal(photo);
  return Object.fromEntries(original ? [...kept, ["original", original]] : kept);
}

/** The JSON of photos, a combined photo list, with each photo's pipeline-only fields taken off. */
function withoutPrivateFields(json: string): string {
  const photos: unknown = JSON.parse(json);
  if (!Array.isArray(photos)) return json;
  return JSON.stringify(
    photos.map((photo: unknown) =>
      photo && typeof photo === "object" ? withoutPrivate(photo) : photo,
    ),
  );
}

/**
 * Takes the photographer-only notes, the EXIF edit notes and any unedited original not shown on the
 * portfolio (see docs/unedited-originals.md) off every photo in the combined photo lists as they're
 * imported, before Vite turns them into a module, so they never reach the
 * portfolio's build or its dev server's pages. See docs/photo-notes.md and docs/r2-exif.md.
 */
export function privatePhotoNotes(): Plugin {
  return {
    name: "private-photo-notes",
    enforce: "pre",
    transform(code, id) {
      if (!ALL_PHOTOS.test(id.split("?")[0] ?? id)) return null;
      return { code: withoutPrivateFields(code), map: null };
    },
  };
}

/** The module that says how many photos have an unedited original shown on the portfolio. */
const SHOWN_ORIGINALS = "virtual:shown-originals";

/** The photos in a combined photo list at path, or none when it's missing or unreadable. */
function readPhotos(path: string): object[] {
  try {
    const photos: unknown = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(photos) ? photos : [];
  } catch {
    return [];
  }
}

/**
 * Gives the app `virtual:shown-originals`, how many photos have an unedited original the portfolio
 * may show, counted from the same list the app reads (ALLPHOTOS.local.json when it has photos, or
 * else ALLPHOTOS.json), so the site menu can leave out Raw vs Edited without loading every photo.
 * See docs/unedited-originals.md.
 */
export function shownOriginals(photosFolder: string): Plugin {
  return {
    name: "shown-originals",
    resolveId: (id) => (id === SHOWN_ORIGINALS ? `\0${SHOWN_ORIGINALS}` : null),
    load(id) {
      if (id !== `\0${SHOWN_ORIGINALS}`) return null;
      const local = readPhotos(path.join(photosFolder, "ALLPHOTOS.local.json"));
      const photos =
        local.length > 0 ? local : readPhotos(path.join(photosFolder, "ALLPHOTOS.json"));
      const count = photos.filter((photo) => publicOriginal(photo)).length;
      return `export const shownOriginals = ${count};`;
    },
  };
}
