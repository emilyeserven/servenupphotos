import { queryOptions } from "@tanstack/react-query";
import { requestJson } from "@/api/settings";
import type { AreaShape } from "@/api/trip-lines";

/** An area with an outline, as `GET /api/areas` answers it. */
export interface Area {
  /** What it's called, such as "Osaka Castle Park". */
  name: string;
  /** Where it is, written in full. */
  place: string;
  /** What sort of area it is, such as "park" or "city". */
  kind: string;
  /** Its OpenStreetMap ID, such as "R358674". */
  osm: string;
  shape: AreaShape;
}

/**
 * The areas with an outline matching a name or a Wikidata ID (such as Q1490), from OpenStreetMap
 * through Nominatim. The backend asks at most once a second.
 */
export function areasQuery(q: string) {
  return queryOptions({
    queryKey: ["areas", q],
    queryFn: () => requestJson<Area[]>(`/api/areas?q=${encodeURIComponent(q)}`),
    enabled: q.trim() !== "",
    retry: false,
    staleTime: Infinity,
  });
}
