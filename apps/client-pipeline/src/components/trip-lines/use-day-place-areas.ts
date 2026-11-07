import { circleShape } from "@portfolio/lib/place-circle";
import { useQueries } from "@tanstack/react-query";
import { type PlaceArea, placeAreaQuery } from "@/api/place-areas";
import type { AreaShape, TripFence } from "@/api/trip-lines";
import type { TripPhoto, TripPlace } from "@/lib/trip-days";

/** The places the day's photos are at, each once, in the order first seen. */
function placesOf(photos: TripPhoto[]): TripPlace[] {
  const seen = new Map(photos.flatMap((p) => (p.place ? [[p.place.id, p.place] as const] : [])));
  return [...seen.values()];
}

/**
 * The place's shape on the map: its saved area, or else a circle around its position, so it reads
 * apart from a photo's pin; none while its area loads or when it has neither.
 */
function placeShape(place: TripPlace, area: PlaceArea | null | undefined): AreaShape | undefined {
  return area === null ? circleAround(place) : area?.shape;
}

/** A circle around the place's position, or none when it has no position. */
function circleAround({ latitude, longitude }: TripPlace): AreaShape | undefined {
  if (latitude === undefined || longitude === undefined) return undefined;
  return circleShape(longitude, latitude);
}

/**
 * The areas of the places the day's photos are at, shaped like trip line areas so the map shades
 * them the same way: each place's saved area, or a circle around a place that has none.
 */
export function useDayPlaceAreas(photos: TripPhoto[]): TripFence[] {
  const places = placesOf(photos);
  const areas = useQueries({ queries: places.map((p) => placeAreaQuery(p.id)) });
  return places.flatMap((place, i) => {
    const shape = placeShape(place, areas[i]?.data);
    return shape ? [{ name: place.name, photos: [], shape }] : [];
  });
}
