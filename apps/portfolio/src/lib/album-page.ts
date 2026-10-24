/** How many photos an album's page shows before it's opened in full. */
export const PREVIEW_COUNT = 5;

/** An album page's search: whether every photo shows, and the photo open in the lightbox. */
export interface AlbumSearch {
  all?: true;
  photo?: number;
}

/** Whether the URL's search asks for every photo, as `?all=true`. */
export function parseAll(search: Record<string, unknown>): { all?: true } {
  return search.all === true || search.all === "true" ? { all: true } : {};
}
