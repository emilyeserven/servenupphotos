import { queryOptions } from "@tanstack/react-query";
import { transitJson } from "@/api/transit-log";
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
      transitJson<TransitLine[]>(
        `/api/transit/lines?mode=${encodeURIComponent(ask.mode)}&${spotParams(ask)}`,
      ),
    retry: false,
    staleTime: Infinity,
  });
}

/** A station or stop on a line, where a hop can get on or off. */
export interface TransitStop {
  name: string;
  latitude: number;
  longitude: number;
}

/** A line's stations or stops, in the order it runs. */
export function transitStopsQuery(id: number) {
  return queryOptions({
    queryKey: ["transit", "stops", id],
    queryFn: () => transitJson<TransitStop[]>(`/api/transit/lines/${id}/stops`),
    retry: false,
    staleTime: Infinity,
  });
}

/** A station or stop found by name, as `GET /api/transit/stations` answers it. */
export interface TransitStation {
  /** Its name, such as "博多", and its English one when it has another, such as "Hakata". */
  name: string;
  nameEn?: string;
  latitude: number;
  longitude: number;
  /** How far it is from the spot it was looked for near. */
  km: number;
}

/**
 * The service a station search asks: Photon (photon.komoot.io, a fast name search over
 * OpenStreetMap's data) or OpenStreetMap's Overpass servers, which tell subway and train stations
 * apart but are often slow.
 */
export type StationSource = "photon" | "overpass";

/** What a station search asks: the kind of line, the name typed, a spot it's near, and where. */
export interface StationAsk {
  mode: string;
  name: string;
  near: Spot;
  source: StationSource;
}

/**
 * The stations or stops of the kind whose name has the name typed, within 30 km of the spot, from
 * OpenStreetMap's data through the source picked.
 */
export function transitStationsQuery({ mode, name, near, source }: StationAsk) {
  const params = new URLSearchParams({ mode, q: name, near: near.join(","), source });
  return queryOptions({
    queryKey: ["transit", "stations", mode, name, near, source],
    queryFn: () => transitJson<TransitStation[]>(`/api/transit/stations?${params}`),
    retry: false,
    staleTime: Infinity,
  });
}

/** Line id's track between two spots, each point [longitude, latitude]. */
export function fetchTrack(id: number, from: Spot, to: Spot): Promise<{ path: Spot[] }> {
  return transitJson<{ path: Spot[] }>(
    `/api/transit/lines/${id}/track?${spotParams({ from, to })}`,
  );
}
