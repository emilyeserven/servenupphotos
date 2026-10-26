import { type CombinedPhoto, photoText } from "@/lib/group-photos";

/** The photo's ID from its JSON, or undefined for an older file without one. */
export function photoId(photo: CombinedPhoto): number | undefined {
  return typeof photo.id === "number" ? photo.id : undefined;
}

/** The photo's old place among the homepage's photos, or after every photo with one. */
function oldPlace(photo: CombinedPhoto): number {
  const place = photo.websiteSpotlight;
  return typeof place === "number" ? place : Number.MAX_SAFE_INTEGER;
}

/** Newest first, by the EXIF date. */
function byNewest(a: CombinedPhoto, b: CombinedPhoto): number {
  return (photoText(b, "createDate") ?? "").localeCompare(photoText(a, "createDate") ?? "");
}

/**
 * The photos in an album's default order, as the portfolio has it without a photo order: ones with
 * an old homepage place first, in that order, then the rest, newest first.
 */
function defaultOrder(photos: CombinedPhoto[]): CombinedPhoto[] {
  return photos.toSorted((a, b) => oldPlace(a) - oldPlace(b) || byNewest(a, b));
}

/** The photo's place in order, or after every photo it lists. */
function placeIn(order: readonly number[], photo: CombinedPhoto): number {
  const place = order.indexOf(photoId(photo) ?? 0);
  return place === -1 ? Number.MAX_SAFE_INTEGER : place;
}

/**
 * The photos as the portfolio orders an album: the ones in its photo order first, in that order,
 * then the rest in the default order. Without a photo order, that's the default order.
 */
export function albumPhotoOrder(
  photos: CombinedPhoto[],
  order: readonly number[] = [],
): CombinedPhoto[] {
  return defaultOrder(photos).toSorted((a, b) => placeIn(order, a) - placeIn(order, b));
}

/** The list with the item at from moved to to, the others keeping their order. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/**
 * The photo order to save for the shown photos in their new order: their IDs, then the IDs the
 * album's order already lists that aren't shown, such as a sub-album's photos while they're hidden,
 * so those keep their places.
 */
export function savedPhotoOrder(
  shown: CombinedPhoto[],
  previous: readonly number[] = [],
): number[] {
  const ids = shown.flatMap((photo) => photoId(photo) ?? []);
  return [...ids, ...previous.filter((id) => !ids.includes(id))];
}
