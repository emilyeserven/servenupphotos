import { ArrowRight } from "lucide-react";
import type { TripPoint, TripSegment } from "@/api/trip-lines";
import type { TripLegRide } from "@/api/trips";
import { LineBadge } from "@/components/trip-lines/line-choices";

/**
 * Each line a hop rode in turn, one row each, such as 北松江線 from 電鉄出雲市 to 川跡 and then
 * 大社線 from 川跡 to 出雲大社前; nothing for a hop that rode one line.
 */
export function HopRideRows({ hop }: { hop: TripSegment }) {
  const rides = hop.rides ?? [];
  if (rides.length < 2) return null;
  return (
    <ol className="flex flex-col gap-1 border-l-2 pl-3 text-sm" aria-label="Lines ridden in turn">
      {rides.map((ride, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground w-12">Line {i + 1}</span>
          <LineBadge line={ride.line} />
          <RideStations from={rideStart(hop, rides, i)} to={rideEnd(hop, ride)} />
        </li>
      ))}
    </ol>
  );
}

/** Where ride i got on: where the hop did for the first, or else where the ride before changed. */
function rideStart(hop: TripSegment, rides: TripLegRide[], i: number): TripPoint | undefined {
  return i === 0 ? hop.board : rides[i - 1]?.change;
}

/** Where the ride got off: the station it changed at, or else where the hop did. */
function rideEnd(hop: TripSegment, ride: TripLegRide): TripPoint | undefined {
  return ride.change ?? hop.alight;
}

/** The stations a ride ran between, "at the photo" for an end with none. */
function RideStations({ from, to }: { from?: TripPoint; to?: TripPoint }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1">
      {placeName(from)}
      <ArrowRight className="size-3" aria-hidden />
      {placeName(to)}
    </span>
  );
}

/** The station's name, or where the ride started or ended without one. */
function placeName(p?: TripPoint): string {
  if (!p) return "the photo";
  return p.label || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`;
}
