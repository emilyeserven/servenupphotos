import type { PhotoSet } from "@portfolio/lib/photo-sets";

/** What the map needs of a photo to put it in a set: its ID and where it is. */
interface SetMember {
  id: number;
  latitude: number;
  longitude: number;
  /** Whether it's placed at one of its places rather than its own GPS position. */
  approximatePosition?: boolean;
}

/** A Photo Set as the map draws it: one marker for the photos of it the filters leave. */
export interface PlacedSet<T extends SetMember> {
  id: string;
  name: string;
  /** Its photos on the map, in the set's order; the first is the one on its marker. */
  photos: T[];
  /** Where its marker goes: the middle of its photos. */
  longitude: number;
  latitude: number;
  /** Whether every photo in it is placed at one of its places, so its marker's border is softer. */
  approximate: boolean;
}

/** The sets the map draws, and the photos it draws on their own or in its groups. */
export interface SplitPhotos<T extends SetMember> {
  sets: PlacedSet<T>[];
  loose: T[];
}

/** The middle of the photos, as the average of their positions. */
function middleOf(photos: SetMember[]): { longitude: number; latitude: number } {
  const sum = (pick: (photo: SetMember) => number) =>
    photos.reduce((total, photo) => total + pick(photo), 0) / photos.length;
  return { longitude: sum((photo) => photo.longitude), latitude: sum((photo) => photo.latitude) };
}

/**
 * Splits the photos on the map into its Photo Sets and the rest. A set is drawn when at least two of
 * its photos are on the map; with one left, that photo is drawn on its own like any other. A photo
 * in more than one set goes with the first.
 */
export function splitSets<T extends SetMember>(placed: T[], sets: PhotoSet[]): SplitPhotos<T> {
  const byId = new Map(placed.map((photo) => [photo.id, photo]));
  const taken = new Set<number>();
  const shown: PlacedSet<T>[] = [];
  for (const set of sets) {
    const photos = set.photos.flatMap((id) => {
      const photo = byId.get(id);
      return photo && !taken.has(id) ? [photo] : [];
    });
    if (photos.length < 2) continue;
    for (const photo of photos) taken.add(photo.id);
    const approximate = photos.every((photo) => photo.approximatePosition);
    shown.push({ id: set.id, name: set.name, photos, approximate, ...middleOf(photos) });
  }
  return { sets: shown, loose: placed.filter((photo) => !taken.has(photo.id)) };
}
