import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { requestJson } from "@/api/settings";
import type { TripTransitLine } from "@/api/trip-lines";

/** A spot as [longitude, latitude]. */
export type Spot = [number, number];

/**
 * A bus, subway or train line OpenStreetMap maps, usually one direction of one route, as
 * `GET /api/transit/lines` answers it.
 */
export interface TransitLine extends TripTransitLine {
  /** OpenStreetMap's kind of route, such as "subway". */
  kind: string;
  /** Where the line starts, when mapped. */
  from?: string;
  /** Where it ends, when mapped. */
  to?: string;
}

/** What a hop's look-ups ask about: how it was travelled, and its first and last spots. */
export interface HopAsk {
  mode: string;
  from: Spot;
  to: Spot;
}

/** The look-up's spots as the query string writes them. */
function spotParams({ from, to }: Pick<HopAsk, "from" | "to">): string {
  return new URLSearchParams({ from: from.join(","), to: to.join(",") }).toString();
}

/**
 * The lines of the hop's kind whose track passes near both its spots, from OpenStreetMap through
 * the Overpass API. The backend asks at most once a second.
 */
export function transitLinesQuery(ask: HopAsk) {
  return queryOptions({
    queryKey: ["transit", "lines", ask],
    queryFn: () =>
      requestJson<TransitLine[]>(
        `/api/transit/lines?mode=${encodeURIComponent(ask.mode)}&${spotParams(ask)}`,
      ),
    retry: false,
    staleTime: Infinity,
  });
}

/** A line's track between the hop's two spots, each point [longitude, latitude]. */
export const transitTrackMutation = mutationOptions({
  mutationKey: ["transit", "track"],
  mutationFn: ({ line, ...ask }: Omit<HopAsk, "mode"> & { line: TripTransitLine }) =>
    requestJson<{ path: Spot[] }>(`/api/transit/lines/${line.id}/track?${spotParams(ask)}`),
});
