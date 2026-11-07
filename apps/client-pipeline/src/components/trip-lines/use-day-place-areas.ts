import { useQueries } from "@tanstack/react-query";
import { placeAreaQuery } from "@/api/place-areas";
import type { TripFence } from "@/api/trip-lines";
import type { TripPhoto } from "@/lib/trip-days";

/** The places the day's photos are at, each once, in the order first seen. */
function placesOf(photos: TripPhoto[]): { id: string; name: string }[] {
  const seen = new Map(photos.flatMap((p) => (p.place ? [[p.place.id, p.place] as const] : [])));
  return [...seen.values()];
}

/**
 * The saved areas of the places the day's photos are at, shaped like trip line areas so the map
 * shades them the same way; a place without an area is left out.
 */
export function useDayPlaceAreas(photos: TripPhoto[]): TripFence[] {
  const places = placesOf(photos);
  const areas = useQueries({ queries: places.map((p) => placeAreaQuery(p.id)) });
  return places.flatMap((place, i) => {
    const area = areas[i]?.data;
    return area ? [{ name: place.name, photos: [], shape: area.shape }] : [];
  });
}
