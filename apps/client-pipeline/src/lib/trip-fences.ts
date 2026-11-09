import type { Area } from "@/api/areas";
import type { TripFence, TripPoint } from "@/api/trip-lines";
import type { LoosePhoto } from "@/lib/trip-days";
import { changedItem, withItem, type GapDraft } from "@/lib/trip-gaps";

/** The area as a fence holding photos (by ID), named after it. */
export function areaFence({ name, osm, shape }: Area, photos: number[]): TripFence {
  return { name, osm, shape, photos };
}

/** The draft with the fence added. */
export function withFence(draft: GapDraft, fence: TripFence): GapDraft {
  return withItem(draft, "fences", fence);
}

/** The draft with fence i changed, or removed for null. */
export function changedFence(draft: GapDraft, i: number, fence: TripFence | null): GapDraft {
  return changedItem(draft, "fences", i, fence);
}

/**
 * The draft with photo id put in fence i, taken out of any other (a photo is in one area), or
 * taken out of fence i when it's in it already.
 */
export function toggledPhoto(draft: GapDraft, i: number, id: number): GapDraft {
  const fences = (draft.fences ?? []).map((f, n) => {
    const without = f.photos.filter((p) => p !== id);
    return n === i && without.length === f.photos.length
      ? { ...f, photos: [...without, id] }
      : { ...f, photos: without };
  });
  return { ...draft, fences };
}

/** The photos not in any of the fences yet. */
export function unfenced(loose: LoosePhoto[], fences: TripFence[] | undefined): LoosePhoto[] {
  const fenced = new Set((fences ?? []).flatMap((f) => f.photos));
  return loose.filter((p) => !fenced.has(p.id));
}

/** What to search for first: the place or else the city of the first photo not in an area yet. */
export function firstSearch(loose: LoosePhoto[]): string {
  const photo = loose[0];
  return photo?.place?.name ?? cityOf(photo);
}

/** The photo's city, or "" when it has none or there's no photo. */
function cityOf(photo: LoosePhoto | undefined): string {
  const city = photo?.photo.city;
  return typeof city === "string" ? city : "";
}

/** The corners of the box around each fence's outline, so the map's view can fit them. */
export function fenceCorners(fences: TripFence[] | undefined): TripPoint[] {
  return (fences ?? []).flatMap(({ shape }) => {
    const points = shape.flat(2);
    if (points.length === 0) return [];
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    return [
      { latitude: Math.min(...lats), longitude: Math.min(...lngs) },
      { latitude: Math.max(...lats), longitude: Math.max(...lngs) },
    ];
  });
}
