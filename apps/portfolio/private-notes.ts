import type { Plugin } from "vite";

/** The combined photo lists the portfolio imports: ALLPHOTOS.json and ALLPHOTOS.local.json. */
const ALL_PHOTOS = /[/\\]ALLPHOTOS(\.local)?\.json$/;

/**
 * The photo fields only the pipeline uses, which the pipeline writes: the photographer-only notes,
 * and the edits made to each original's EXIF in R2.
 */
const PRIVATE_KEYS = ["notes", "r2ExifEdits"];

/** The JSON of photos, a combined photo list, with each photo's pipeline-only fields taken off. */
function withoutPrivateFields(json: string): string {
  const photos: unknown = JSON.parse(json);
  if (!Array.isArray(photos)) return json;
  return JSON.stringify(
    photos.map((photo: unknown) => {
      if (!photo || typeof photo !== "object") return photo;
      return Object.fromEntries(
        Object.entries(photo).filter(([key]) => !PRIVATE_KEYS.includes(key)),
      );
    }),
  );
}

/**
 * Takes the photographer-only notes and the EXIF edit notes off every photo in the combined photo
 * lists as they're imported, before Vite turns them into a module, so they never reach the
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
