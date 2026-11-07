import type { TripPhoto } from "@/lib/trip-days";

/**
 * The day's photos in the order moved into by hand (photo IDs), or as taken when there's none.
 * A photo the order doesn't list, such as one added since, goes after the photo taken just before
 * it, or first when none was; an ID no longer on the day is left out.
 */
export function orderedPhotos(photos: TripPhoto[], order: number[] | undefined): TripPhoto[] {
  if (!order) return photos;
  const byId = new Map(photos.map((p) => [p.id, p]));
  const listed = order.flatMap((id) => byId.get(id) ?? []);
  const known = new Set(listed.map((p) => p.id));
  return photos.reduce(
    (all, photo, i) => (known.has(photo.id) ? all : withAfter(all, photo, photos[i - 1])),
    listed,
  );
}

/** photos with photo put just after `after`, or first when `after` isn't there. */
function withAfter(
  photos: TripPhoto[],
  photo: TripPhoto,
  after: TripPhoto | undefined,
): TripPhoto[] {
  const at = photos.findIndex((p) => p.id === after?.id) + 1;
  return [...photos.slice(0, at), photo, ...photos.slice(at)];
}

/** ids with id swapped with its neighbour one place earlier (-1) or later (1); unchanged at an end. */
export function movedId(ids: number[], id: number, by: -1 | 1): number[] {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from === -1 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to] as number, id];
  return next;
}

/** The order to save: ids when they differ from the order the photos were taken, or else none. */
export function orderToSave(photos: TripPhoto[], ids: number[]): number[] | undefined {
  return ids.some((id, i) => photos[i]?.id !== id) ? ids : undefined;
}
