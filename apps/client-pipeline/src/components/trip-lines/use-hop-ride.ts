import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  fetchTrack,
  type HopAsk,
  type Spot,
  type TransitLine,
  transitLinesQuery,
  transitStopsQuery,
} from "@/api/transit";
import type { TripPoint, TripSegment, TripTransitLine } from "@/api/trip-lines";
import { oneLine, type Ride, rideSpots, type Stations, stationsFor } from "@/lib/transit-ride";

/** The line as a hop keeps it: no kind or ends. */
function lineOf({ id, name, ref, colour }: TripTransitLine): TripTransitLine {
  return { id, name, ...(ref && { ref }), ...(colour && { colour }) };
}

/**
 * The ride on line between the stations chosen (the stops nearest near's spots where none was),
 * with its track, which runs from ask's photos where it got on or off at one.
 */
async function rideOn(
  client: QueryClient,
  [ask, near]: [HopAsk, HopAsk],
  line: TripTransitLine,
  chosen: Stations,
): Promise<Ride> {
  const stops = await client.fetchQuery(transitStopsQuery(line.id));
  const stations = stationsFor(stops, near, chosen);
  const { path } = await fetchTrack(line.id, ...rideSpots(ask, stations));
  return { line, path, ...stations };
}

/**
 * Rides a line: gets its stops and track for the hop, then hands the ride on. near is ask with the
 * stations picked in place of its photos.
 */
function useRide(ask: HopAsk | undefined, near: HopAsk | undefined, onRide: (ride: Ride) => void) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ line, chosen }: { line: TripTransitLine; chosen: Stations }) =>
      rideOn(client, [ask!, near!], line, chosen),
    onSuccess: onRide,
  });
  const ride = (line: TripTransitLine, chosen: Stations = {}) =>
    ask && mutation.mutate({ line: lineOf(line), chosen });
  return { mutation, ride };
}

/** Whether to pick the line found by itself: once, with no line yet, when all found are one line. */
function autoPicks(tried: boolean, hop: TripSegment, lines?: TransitLine[]): boolean {
  return !tried && !hop.line && oneLine(lines);
}

/** Picks the line found by itself when it's the only one, such as both directions of one line. */
function useAutoPick(
  hop: TripSegment,
  lines: TransitLine[] | undefined,
  ride: (l: TransitLine) => void,
) {
  const tried = useRef(false);
  useEffect(() => {
    if (!autoPicks(tried.current, hop, lines)) return;
    tried.current = true;
    ride(lines![0]!);
  });
}

/** The kind to look lines up as at first: the hop's own, or none for a transit hop, whose kind is picked. */
function firstKind(mode: string): string | undefined {
  return mode === "transit" ? undefined : mode;
}

/**
 * The stations a hop with no line yet is looked up near, when its photos are a walk from them: say
 * the beach was a 15-minute walk from the end of the line.
 */
export interface HopEnds {
  /** The station it got on at; none looks near the first photo. */
  board?: TripPoint;
  /** The station it got off at; none looks near the last photo. */
  alight?: TripPoint;
}

/** The station as a spot, or else the photo's spot. */
function spotOr(station: TripPoint | undefined, photo: Spot): Spot {
  return station ? [station.longitude, station.latitude] : photo;
}

/** What the hop's look-ups ask with its stations standing in for its photos; none with no ask. */
function nearOf(ask: HopAsk | undefined, ends: HopEnds): HopAsk | undefined {
  if (!ask) return undefined;
  return { ...ask, from: spotOr(ends.board, ask.from), to: spotOr(ends.alight, ask.to) };
}

/** What the lines look-up asks: the hop's spots as kind; none until both are known. */
function lookupOf(ask: HopAsk | undefined, kind: string | undefined): HopAsk | undefined {
  if (!ask || !kind) return undefined;
  return { ...ask, mode: kind };
}

/**
 * A hop's look-ups: the lines near both its photos (or the stations picked in their place), found
 * at once when it has no line yet (for a transit hop, once the kind of line is picked), and riding
 * one, which picks it by itself when it's the only line found. Riding gets on and off at the stop
 * nearest each station picked.
 */
export function useHopRide(hop: TripSegment, ask: HopAsk | undefined, onRide: (r: Ride) => void) {
  const [finding, setFinding] = useState(!hop.line);
  const [kind, setKind] = useState(firstKind(hop.mode));
  const [ends, setEnds] = useState<HopEnds>({});
  const near = nearOf(ask, ends);
  const lookup = lookupOf(near, kind);
  const lines = useQuery({
    ...transitLinesQuery(lookup!),
    enabled: finding && lookup !== undefined,
  });
  const { mutation, ride } = useRide(ask, near, (r) => (onRide(r), setFinding(false)));
  useAutoPick(hop, lines.data, ride);
  return { finding, setFinding, kind, setKind, ends, setEnds, lines, mutation, ride };
}
