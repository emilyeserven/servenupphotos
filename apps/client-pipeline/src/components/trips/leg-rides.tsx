import { Combine, Split } from "lucide-react";
import type { Spot } from "@/api/transit";
import type { TripLeg, TripLegRide } from "@/api/trips";
import { RouteSourcePicker } from "@/components/trip-lines/route-source-picker";
import { AddChange, ChangeStop } from "@/components/trips/leg-change";
import { LineFinder } from "@/components/trips/line-finder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  allPicked,
  midway,
  rideEnds,
  ridesOf,
  withChange,
  withChangeStation,
  withoutChange,
  withRideLine,
  withCombined,
  withRides,
  withSeparateRides,
} from "@/lib/leg-rides";

interface LegRidesProps {
  leg: TripLeg;
  /** Where the leg leaves and arrives, as [longitude, latitude]. */
  ends: [Spot, Spot];
  onChange: (leg: TripLeg) => void;
}

/**
 * The lines a leg rode: one, or one for each ride when it changed lines on the way, such as at
 * Nagato-shi between Shimonoseki and Higashi-Hagi. Once each ride has its line, they make one route,
 * which can be renamed, such as "Marumaru no Hanashi".
 */
export function LegRides({ leg, ends, onChange }: LegRidesProps) {
  const rides = ridesOf(leg);
  const stretches = rideEnds(rides, ends);
  const update = (next: TripLegRide[]) => onChange(withRides(leg, next));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Route:</span>
        <RouteSourcePicker />
      </div>
      {rides.map((ride, i) => (
        <div key={i} className="flex flex-col gap-2">
          <LineFinder
            mode={leg.mode}
            line={ride.line}
            ends={stretches[i]!}
            onLine={(line, path) => update(withRideLine(rides, i, line, path))}
          />
          <ChangeStop
            change={ride.change}
            onChange={(station) => update(withChangeStation(rides, i, station))}
            onRemove={() => update(withoutChange(rides, i))}
          />
        </div>
      ))}
      <AddChange
        mode={leg.mode}
        near={midway(stretches.at(-1)!)}
        onAdd={(station) => update(withChange(rides, station))}
      />
      <CombineRoute leg={leg} rides={rides} onChange={onChange} />
      <RouteName leg={leg} onChange={onChange} />
    </div>
  );
}

/** The route's name, such as "Marumaru no Hanashi" for the lines it rode together; once it has one. */
function RouteName({ leg, onChange }: Pick<LegRidesProps, "leg" | "onChange">) {
  if (!leg.line) return null;
  const line = leg.line;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">Route name</span>
      <Input
        value={line.name}
        aria-label="Route name"
        onChange={(e) => onChange({ ...leg, line: { ...line, name: e.target.value } })}
      />
    </label>
  );
}

interface CombineRouteProps extends Pick<LegRidesProps, "leg" | "onChange"> {
  rides: TripLegRide[];
}

/**
 * Offers to draw the rides as one route under one name, such as a through train, once each has its
 * line, or to split a combined route back into its lines.
 */
function CombineRoute({ leg, rides, onChange }: CombineRouteProps) {
  if (!allPicked(rides)) return null;
  if (leg.line) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => onChange(withSeparateRides(leg))}
      >
        <Split aria-hidden />
        Show as separate lines
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="self-start"
      onClick={() => onChange(withCombined({ ...leg, rides }))}
    >
      <Combine aria-hidden />
      Combine into one route
    </Button>
  );
}
