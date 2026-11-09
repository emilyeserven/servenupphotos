import { Plus, TrainFront, X } from "lucide-react";
import { useState } from "react";
import type { Spot } from "@/api/transit";
import type { TripPoint } from "@/api/trip-lines";
import type { TripLeg, TripLegRide } from "@/api/trips";
import { RouteSourcePicker } from "@/components/trip-lines/route-source-picker";
import { LineFinder } from "@/components/trips/line-finder";
import { StationSearch } from "@/components/trips/station-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  midway,
  rideEnds,
  ridesOf,
  withChange,
  withoutChange,
  withRideLine,
  withRides,
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
          <ChangeStop change={ride.change} onRemove={() => update(withoutChange(rides, i))} />
        </div>
      ))}
      <AddChange
        mode={leg.mode}
        near={midway(stretches.at(-1)!)}
        onAdd={(station) => update(withChange(rides, station))}
      />
      <RouteName leg={leg} onChange={onChange} />
    </div>
  );
}

/** The station it changed lines at after a ride, with a way to take the change out. */
function ChangeStop({ change, onRemove }: { change?: TripPoint; onRemove: () => void }) {
  if (!change) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <TrainFront className="text-muted-foreground size-3.5" aria-hidden />
      <span className="text-muted-foreground">Changed at</span>
      <span className="min-w-0 flex-1 truncate">{change.label}</span>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        <X aria-hidden />
        No change here
      </Button>
    </div>
  );
}

interface AddChangeProps {
  mode: string;
  /** Where to look for the station: halfway along the last ride. */
  near: Spot;
  onAdd: (station: TripPoint) => void;
}

/** Adds a station it changed lines at, on the way of the last ride, found by name. */
function AddChange({ mode, near, onAdd }: AddChangeProps) {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setAdding(true)}>
        <Plus aria-hidden />
        Changed lines on the way
      </Button>
    );
  }
  return (
    <StationSearch
      title="Changed at"
      mode={mode}
      near={near}
      onPick={(station) => {
        onAdd(station);
        setAdding(false);
      }}
    />
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
