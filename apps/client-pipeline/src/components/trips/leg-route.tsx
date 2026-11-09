import type { Spot } from "@/api/transit";
import type { TripLeg } from "@/api/trips";
import { LegRides } from "@/components/trips/leg-rides";
import { ridesLegLine } from "@/lib/trip-legs";

interface LegRouteProps {
  leg: TripLeg;
  /** Where the leg leaves and arrives, as [longitude, latitude]; none while an end has no spot. */
  ends?: [Spot, Spot];
  onChange: (leg: TripLeg) => void;
}

/**
 * The train, bus or ferry line a leg rode: **Look up route** finds the lines OpenStreetMap or
 * Transitland maps near both of its ends (best with each end at its station), and picking one draws
 * the leg along the line's track, in its color. A leg that changed lines on the way picks a line
 * for each ride. Nothing for a flight or a drive.
 */
export function LegRoute({ leg, ends, onChange }: LegRouteProps) {
  if (!ridesLegLine(leg.mode)) return null;
  if (!ends) {
    return (
      <p className="text-muted-foreground text-xs">
        Give both ends a spot to look up the route it rode.
      </p>
    );
  }
  return <LegRides leg={leg} ends={ends} onChange={onChange} />;
}
