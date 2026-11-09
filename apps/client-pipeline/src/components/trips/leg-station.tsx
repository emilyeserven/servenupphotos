import { PenLine, X } from "lucide-react";
import { useState } from "react";
import type { TripPoint } from "@/api/trip-lines";
import type { TripLegEnd } from "@/api/trips";
import { PointFields } from "@/components/trips/point-fields";
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
 * ferry terminal a walk from the day's last photo: found by name, or typed by hand as a label and
 * position. The leg then runs from the station, and the photo stays the end's photo. A station for
 * the day's usual photo names that photo, so the station stays with it.
 */
export function LegStation({ title, mode, end, photo, onChange }: LegStationProps) {
  const [picked, setPicked] = useState(0);
  if (!photo || !offersStation(mode, end)) return null;
  const setStation = (station: TripPoint) => {
    onChange({ ...end, photo: end.photo ?? photo.id, station });
    setPicked((n) => n + 1);
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">Station near the photo (optional)</span>
      <StationSearch
        title={`${title}: station`}
        mode={mode}
        near={[photo.longitude, photo.latitude]}
        onPick={setStation}
      />
      {end.station ? (
        <TypedStation
          key={picked}
          title={title}
          station={end.station}
          onChange={(station) => onChange({ ...end, station })}
          onClear={() => onChange(withoutStation(end))}
        />
      ) : (
        <TypeItButton onClick={() => setStation(startingStation(photo))} />
      )}
    </div>
  );
}

/** Whether the end can have a station near its photo: a train, bus or ferry leg's end not at a spot. */
function offersStation(mode: string, end: TripLegEnd): boolean {
  return !end.spot && ridesLegLine(mode);
}

/** A new station typed by hand, at the photo to move from there. */
function startingStation(photo: TripPhoto): TripPoint {
  return { label: "", latitude: photo.latitude, longitude: photo.longitude };
}

/** The end without its station: the leg runs from the photo again. */
function withoutStation({ station: _station, ...end }: TripLegEnd): TripLegEnd {
  return end;
}

/** Starts a station typed by hand, for when the search can't find it. */
function TypeItButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="self-start" onClick={onClick}>
      <PenLine aria-hidden />
      Type the station instead
    </Button>
  );
}

interface TypedStationProps {
  title: string;
  station: TripPoint;
  onChange: (station: TripPoint) => void;
  onClear: () => void;
}

/** The station's label and position, typed or filled in by the search, with a way back to the photo. */
function TypedStation({ title, station, onChange, onClear }: TypedStationProps) {
  return (
    <>
      <PointFields
        point={station}
        title={`${title}: station`}
        placeholder="Shimonoseki Port International Terminal"
        onChange={onChange}
      />
      <Button variant="ghost" size="sm" className="self-start" onClick={onClear}>
        <X aria-hidden />
        From the photo
      </Button>
    </>
  );
}
