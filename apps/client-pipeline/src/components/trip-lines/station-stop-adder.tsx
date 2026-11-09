import { SELECT_CLASS } from "@portfolio/lib/segmented-control";
import { TrainFront } from "lucide-react";
import { useState } from "react";
import type { TripPoint, TripVisit } from "@/api/trip-lines";
import { StationSearch } from "@/components/trips/station-search";
import { Button } from "@/components/ui/button";
import { stationVisit } from "@/lib/trip-visits";

/** The kinds of station that can be looked for, as the menu lists them. */
const STATION_MODES = [
  { mode: "train", label: "Train" },
  { mode: "subway", label: "Subway" },
  { mode: "bus", label: "Bus" },
  { mode: "ferry", label: "Ferry" },
];

interface StationStopAdderProps {
  /** Where to look for the station, such as the day's first photo; none while the day has nothing. */
  near?: TripPoint;
  onAdd: (visit: TripVisit) => void;
}

/**
 * Adds a station as a trip stop, found by name near the day as on a Trip's legs, such as a station
 * changed trains at or one passed through without a photo.
 */
export function StationStopAdder({ near, onAdd }: StationStopAdderProps) {
  const [adding, setAdding] = useState(false);
  if (!near) return null;
  if (!adding) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
        <TrainFront aria-hidden />
        Add a station
      </Button>
    );
  }
  return (
    <StationFinder
      near={near}
      onAdd={(visit) => {
        onAdd(visit);
        setAdding(false);
      }}
    />
  );
}

/** The kind of station and the search for it by name. */
function StationFinder({ near, onAdd }: Required<StationStopAdderProps>) {
  const [mode, setMode] = useState("train");
  return (
    <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-start">
      <select
        aria-label="Kind of station"
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        className={SELECT_CLASS}
      >
        {STATION_MODES.map(({ mode: m, label }) => (
          <option key={m} value={m}>
            {label}
          </option>
        ))}
      </select>
      <div className="min-w-0 flex-1">
        <StationSearch
          title="Station stop"
          mode={mode}
          near={[near.longitude, near.latitude]}
          onPick={(station) => onAdd(stationVisit(station))}
        />
      </div>
    </div>
  );
}
