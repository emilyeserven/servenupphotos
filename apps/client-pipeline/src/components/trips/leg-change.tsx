import { PenLine, Plus, TrainFront, X } from "lucide-react";
import { useState } from "react";
import type { Spot } from "@/api/transit";
import type { TripPoint } from "@/api/trip-lines";
import { PointFields } from "@/components/trips/point-fields";
import { StationSearch } from "@/components/trips/station-search";
import { Button } from "@/components/ui/button";

interface ChangeStopProps {
  change?: TripPoint;
  /** Renames or moves the station; moving it drops the tracks to it. */
  onChange: (station: TripPoint) => void;
  onRemove: () => void;
}

/**
 * The station it changed lines at after a ride, its label and position editable, such as one typed
 * by hand when the search can't find it, with a way to take the change out.
 */
export function ChangeStop({ change, onChange, onRemove }: ChangeStopProps) {
  if (!change) return null;
  return (
    <div className="flex flex-col gap-1 border-l-2 pl-3">
      <div className="flex items-center gap-2 text-sm">
        <TrainFront className="text-muted-foreground size-3.5" aria-hidden />
        <span className="text-muted-foreground flex-1">Changed at</span>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <X aria-hidden />
          No change here
        </Button>
      </div>
      <PointFields
        key={`${change.latitude},${change.longitude}`}
        point={change}
        title="Changed at"
        placeholder="Masuda"
        onChange={onChange}
      />
    </div>
  );
}

interface AddChangeProps {
  mode: string;
  /** Where to look for the station: halfway along the last ride. */
  near: Spot;
  onAdd: (station: TripPoint) => void;
}

/**
 * Adds a station it changed lines at, on the way of the last ride: found by name, or typed by hand
 * for one the search can't find, such as one too far from halfway.
 */
export function AddChange({ mode, near, onAdd }: AddChangeProps) {
  const [adding, setAdding] = useState(false);
  if (!adding) {
    return (
      <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}>
        <Plus aria-hidden />
        Changed lines on the way
      </Button>
    );
  }
  const add = (station: TripPoint) => {
    onAdd(station);
    setAdding(false);
  };
  return (
    <div className="flex flex-col gap-1">
      <StationSearch title="Changed at" mode={mode} near={near} onPick={add} />
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => add({ label: "", latitude: near[1], longitude: near[0] })}
      >
        <PenLine aria-hidden />
        Type the station instead
      </Button>
    </div>
  );
}
