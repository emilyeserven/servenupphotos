import type { Plugin } from "vite";

/** The combined photo lists the portfolio imports: ALLPHOTOS.json and ALLPHOTOS.local.json. */
const ALL_PHOTOS = /[/\\]ALLPHOTOS(\.local)?\.json$/;

/** The photo field that holds the photographer-only notes, which the pipeline writes. */
const NOTES_KEY = "notes";

/** The JSON of photos, a combined photo list, with each photo's photographer-only notes taken off. */
function withoutNotes(json: string): string {
  const photos: unknown = JSON.parse(json);
  if (!Array.isArray(photos)) return json;
  return JSON.stringify(
    photos.map((photo: unknown) => {
      if (!photo || typeof photo !== "object") return photo;
      const { [NOTES_KEY]: _notes, ...rest } = photo as Record<string, unknown>;
      return rest;
    }),
  );
}

/**
 * Takes the photographer-only notes off every photo in the combined photo lists as they're
 * imported, before Vite turns them into a module, so the notes never reach the portfolio's build
 * or its dev server's pages. See docs/photo-notes.md.
 */
export function privatePhotoNotes(): Plugin {
  return {
    name: "private-photo-notes",
    enforce: "pre",
    transform(code, id) {
      if (!ALL_PHOTOS.test(id.split("?")[0] ?? id)) return null;
      return { code: withoutNotes(code), map: null };
    },
  };
}
