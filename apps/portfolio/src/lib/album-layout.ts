import type { Group } from "@/lib/groups";
import type { ImagePhoto } from "@/lib/spotlight-zones";

/** How many photos stand for an album on the Albums page. */
const PREVIEW_COUNT = 5;

/** One row of an album's page: its text above and below, and its photos that have images. */
export interface ShownRow {
  textAbove: string;
  photos: ImagePhoto[];
  textBelow: string;
}

/** The photos with the IDs, in that order, leaving out ones not among photos. */
function byIds(ids: readonly number[], photos: ImagePhoto[]): ImagePhoto[] {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/**
 * The photos that stand for the album on the Albums page: its covers, in their order, or its first
 * 5 photos when it has none (or none of them is among its photos with images).
 */
export function coverPhotos(album: Group, photos: ImagePhoto[]): ImagePhoto[] {
  const covers = byIds(album.covers ?? [], photos).slice(0, PREVIEW_COUNT);
  return covers.length > 0 ? covers : photos.slice(0, PREVIEW_COUNT);
}

/**
 * The album's layout as its page shows it, from photos, its photos in its order: each row with
 * only the photos that are in the album and have images (a row left with neither photos nor text
 * is dropped), then the photos no row has, in the album's order. Without a layout, there are no
 * rows and every photo is in the rest.
 */
export function albumRows(album: Group, photos: ImagePhoto[]) {
  const rows = (album.layout ?? [])
    .map((row) => ({ ...row, photos: byIds(row.photos, photos) }))
    .filter((row) => row.photos.length > 0 || row.textAbove.trim() || row.textBelow.trim());
  const placed = new Set(rows.flatMap((row) => row.photos.map((photo) => photo.id)));
  return { rows, rest: photos.filter((photo) => !placed.has(photo.id)) };
}
