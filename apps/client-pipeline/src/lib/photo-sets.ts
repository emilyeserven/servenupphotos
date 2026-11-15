import type { PhotoSet } from "@portfolio/lib/photo-sets";
import type { SocialPhoto } from "@/api/publish";

/** A photo file's ID, or undefined for one without a numeric ID yet. */
export function photoIdOf(photo: Pick<SocialPhoto, "data">): number | undefined {
  const id = photo.data.id;
  return typeof id === "number" ? id : undefined;
}

/** Each photo in a set, by its ID, with the set it's in. */
export function setsByPhoto(sets: PhotoSet[]): Map<number, PhotoSet> {
  const owners = new Map<number, PhotoSet>();
  for (const set of sets) for (const id of set.photos) if (!owners.has(id)) owners.set(id, set);
  return owners;
}

/** The set with the photo added at the end, unless it's in it already. */
function addSetPhoto(set: PhotoSet, id: number): PhotoSet {
  return set.photos.includes(id) ? set : { ...set, photos: [...set.photos, id] };
}

/** The set without the photo. */
export function removeSetPhoto(set: PhotoSet, id: number): PhotoSet {
  return { ...set, photos: set.photos.filter((photo) => photo !== id) };
}

/** The set with the photo at from moved to to, the others keeping their order. */
export function moveSetPhoto(set: PhotoSet, from: number, to: number): PhotoSet {
  const photos = [...set.photos];
  const [id] = photos.splice(from, 1);
  if (id !== undefined) photos.splice(to, 0, id);
  return { ...set, photos };
}

/**
 * Whether the map can place the photo: it has a GPS position of its own, a custom one, or a place,
 * which the map falls back to.
 */
export function canBeMapped(photo: Pick<SocialPhoto, "data">): boolean {
  const { gpsPosition, customGpsPosition, places } = photo.data;
  return Boolean(gpsPosition || customGpsPosition) || (Array.isArray(places) && places.length > 0);
}

/** What adding a photo to a set does: the set with it, and why it couldn't go in, or "". */
export interface SetAddition {
  set: PhotoSet;
  note: string;
}

/**
 * Adds the photo file to the set, unless another set has it: a photo can be kept together with one
 * set, so it has to come out of that one first. A photo without an ID yet leaves the set as it is.
 * `owners` is each photo's set, by its ID.
 */
export function addToSet(
  set: PhotoSet,
  photo: Pick<SocialPhoto, "data"> | undefined,
  owners: Map<number, PhotoSet>,
): SetAddition {
  const id = photo && photoIdOf(photo);
  if (id === undefined) return { set, note: "" };
  const owner = owners.get(id);
  if (owner && owner.id !== set.id) {
    return {
      set,
      note: `That photo is already in “${owner.name}”. Take it out of that set first.`,
    };
  }
  return { set: addSetPhoto(set, id), note: "" };
}
