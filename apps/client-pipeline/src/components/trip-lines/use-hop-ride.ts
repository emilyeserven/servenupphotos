import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  fetchTrack,
  type HopAsk,
  type TransitLine,
  transitLinesQuery,
  transitStopsQuery,
} from "@/api/transit";
import type { TripSegment, TripTransitLine } from "@/api/trip-lines";
import { oneLine, type Ride, rideSpots, type Stations, stationsFor } from "@/lib/transit-ride";

/** The line as a hop keeps it: no kind or ends. */
function lineOf({ id, name, ref, colour }: TripTransitLine): TripTransitLine {
  return { id, name, ...(ref && { ref }), ...(colour && { colour }) };
}

/** The ride on line between the stations chosen (the nearest stops where none was), with its track. */
async function rideOn(
  client: QueryClient,
  ask: HopAsk,
  line: TripTransitLine,
  chosen: Stations,
): Promise<Ride> {
  const stops = await client.fetchQuery(transitStopsQuery(line.id));
  const stations = stationsFor(stops, ask, chosen);
  const { path } = await fetchTrack(line.id, ...rideSpots(ask, stations));
  return { line, path, ...stations };
}

/** Rides a line: gets its stops and track for the hop, then hands the ride on. */
function useRide(ask: HopAsk | undefined, onRide: (ride: Ride) => void) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ line, chosen }: { line: TripTransitLine; chosen: Stations }) =>
      rideOn(client, ask!, line, chosen),
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

/**
 * A hop's look-ups: the lines near both its photos, found at once when it has no line yet, and
 * riding one, which picks it by itself when it's the only line found.
 */
export function useHopRide(hop: TripSegment, ask: HopAsk | undefined, onRide: (r: Ride) => void) {
  const [finding, setFinding] = useState(!hop.line);
  const lines = useQuery({ ...transitLinesQuery(ask!), enabled: finding && ask !== undefined });
  const { mutation, ride } = useRide(ask, (r) => (onRide(r), setFinding(false)));
  useAutoPick(hop, lines.data, ride);
  return { finding, setFinding, lines, mutation, ride };
}
