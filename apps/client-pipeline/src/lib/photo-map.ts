import { type Place, savedPlaces } from "@/api/places";
import type { CombinedPhoto } from "@/lib/group-photos";
import { gpsSource } from "@/lib/place-gps";
import { photoGps } from "@portfolio/lib/photo-gps";

/**
 * Whether the photo has its own GPS position the portfolio can read: in its EXIF, or a custom one
 * written on the Photo page. It's the portfolio's own `photoGps`, so a position the map can't read
 * doesn't count.
 */
function hasOwnPhotoGps(photo: CombinedPhoto): boolean {
  const { customGpsPosition, gpsPosition } = photo;
  const position = photoGps({
    customGpsPosition: typeof customGpsPosition === "string" ? customGpsPosition : null,
    gpsPosition: typeof gpsPosition === "string" ? gpsPosition : null,
  });
  return position.latitude !== null;
}

/**
 * Whether the photo shows on the portfolio's map: it has its own GPS position, or one of its places
 * (or a place that place is in) has one. Photo Sets don't change this; they only draw photos already
 * on the map as one marker.
 */
export function isOnMap(photo: CombinedPhoto, places: Place[]): boolean {
  return photoGpsSource(photo, places).kind !== "none";
}

/**
 * Where a photo's spot on the portfolio's map comes from: its own GPS position (EXIF or custom), the
 * position of one of its places (or of a place that place is in), or nowhere, so it isn't on the map.
 */
export type PhotoGpsSource = { kind: "own" } | { kind: "place"; place: Place } | { kind: "none" };

/** The place whose GPS position the photo goes on the map at: its first place with one, or a place above it. */
function placeGpsSource(photo: CombinedPhoto, places: Place[]): Place | undefined {
  const byId = new Map(places.map((place) => [place.id, place]));
  for (const { id } of savedPlaces(photo.places)) {
    const place = byId.get(id);
    const source = place && gpsSource(place, places);
    if (source) return source;
  }
  return undefined;
}

/** Where the photo's spot on the portfolio's map comes from, the way the portfolio picks it. */
export function photoGpsSource(photo: CombinedPhoto, places: Place[]): PhotoGpsSource {
  if (hasOwnPhotoGps(photo)) return { kind: "own" };
  const place = placeGpsSource(photo, places);
  return place ? { kind: "place", place } : { kind: "none" };
}
