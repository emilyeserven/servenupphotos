import { TrainFront, X } from "lucide-react";
import type { TripLegEnd } from "@/api/trips";
import { StationSearch } from "@/components/trips/station-search";
import { Button } from "@/components/ui/button";
import type { TripPhoto } from "@/lib/trip-days";
import { ridesLegLine } from "@/lib/trip-legs";

interface LegStationProps {
  /** What the end is, such as "Leaves". */
  title: string;
  mode: string;
  end: TripLegEnd;
  /** The photo the end is at. */
  photo: TripPhoto | undefined;
  onChange: (end: TripLegEnd) => void;
}

/**
 * The station a train, bus or ferry leg got on or off at near the photo its end is at, such as the
 * ferry terminal a walk from the day's last photo. The leg then runs from the station, and the
 * photo stays the end's photo. Picking one for the day's usual photo names that photo, so the
 * station stays with it.
 */
export function LegStation({ title, mode, end, photo, onChange }: LegStationProps) {
  if (!photo || !offersStation(mode, end)) return null;
  const label = `${title}: station`;
  if (end.station) {
    return (
      <PickedStation label={end.station.label} onClear={() => onChange(withoutStation(end))} />
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">Station near the photo (optional)</span>
      <StationSearch
        title={label}
        mode={mode}
        near={[photo.longitude, photo.latitude]}
        onPick={(station) => onChange({ ...end, photo: end.photo ?? photo.id, station })}
      />
    </div>
  );
}

/** Whether the end can have a station near its photo: a train, bus or ferry leg's end not at a spot. */
function offersStation(mode: string, end: TripLegEnd): boolean {
  return !end.spot && ridesLegLine(mode);
}

/** The end without its station: the leg runs from the photo again. */
function withoutStation({ station: _station, ...end }: TripLegEnd): TripLegEnd {
  return end;
}

/** The station picked, with a way back to the photo. */
function PickedStation({ label, onClear }: { label?: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <TrainFront className="text-muted-foreground size-3.5" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label || "Station"}</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X aria-hidden />
        From the photo
      </Button>
    </div>
  );
}
