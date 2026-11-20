import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { del, put, requestJson } from "@/api/request";
import type { AreaShape } from "@/api/trip-lines";

/** The outline of the area a place covers, such as a park, which the portfolio's map shades. */
export interface PlaceArea {
  /** Its OpenStreetMap ID, such as "R358674", when looked up there. */
  osm?: string;
  shape: AreaShape;
}

/** What saving or removing a place's area did. */
interface PlaceAreaResult {
  path: string;
  changed: boolean;
}

/** The place's area, from its places/<id>.geo.json file; null when it has none. */
export function placeAreaQuery(id: string) {
  return queryOptions({
    queryKey: ["place-area", id],
    queryFn: () => requestJson<PlaceArea | null>(`/api/places/${encodeURIComponent(id)}/area`),
  });
}

/** Saves a place's area, as a change waiting for Commit. */
export const savePlaceAreaMutation = mutationOptions({
  mutationKey: ["place-area", "save"],
  scope: { id: "photo-data-entries" },
  meta: { saves: (result) => (result as PlaceAreaResult).changed },
  mutationFn: ({ id, area }: { id: string; area: PlaceArea }) =>
    put<PlaceAreaResult>(`/api/places/${encodeURIComponent(id)}/area`, area),
});

/** Removes a place's area, as a change waiting for Commit. */
export const deletePlaceAreaMutation = mutationOptions({
  mutationKey: ["place-area", "delete"],
  scope: { id: "photo-data-entries" },
  meta: { saves: true },
  mutationFn: (id: string) => del<PlaceAreaResult>(`/api/places/${encodeURIComponent(id)}/area`),
});
