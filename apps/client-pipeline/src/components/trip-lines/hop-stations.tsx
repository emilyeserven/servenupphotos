import { useQuery } from "@tanstack/react-query";
import { type TransitStop, transitStopsQuery } from "@/api/transit";
import type { TripPoint, TripSegment, TripTransitLine } from "@/api/trip-lines";
import { type Stations, stopPoint } from "@/lib/transit-ride";

interface HopStationsProps {
  hop: TripSegment & { line: TripTransitLine };
  disabled: boolean;
  /** Rides the hop's line again between other stations. */
  onChange: (chosen: Stations) => void;
}

/**
 * Where the hop got on and off its line, from the line's stations or stops, such as a station a
 * 10-minute walk from the next photo. "At the photo" rides right from or to it.
 */
export function HopStations({ hop, disabled, onChange }: HopStationsProps) {
  const stops = useQuery(transitStopsQuery(hop.line.id)).data ?? [];
  const keep = { board: hop.board ?? null, alight: hop.alight ?? null };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <StationSelect
        label="Got on at"
        stops={stops}
        value={hop.board}
        disabled={disabled}
        onChange={(board) => onChange({ ...keep, board })}
      />
      <StationSelect
        label="Got off at"
        stops={stops}
        value={hop.alight}
        disabled={disabled}
        onChange={(alight) => onChange({ ...keep, alight })}
      />
    </div>
  );
}

interface StationSelectProps {
  label: string;
  stops: TransitStop[];
  value?: TripPoint;
  disabled: boolean;
  onChange: (station: TripPoint | null) => void;
}

/** The index of the stop at the point, or "" for none. */
function stopIndex(stops: TransitStop[], p?: TripPoint): string {
  const i = stops.findIndex((s) => s.latitude === p?.latitude && s.longitude === p?.longitude);
  return i === -1 ? "" : String(i);
}

/** One station picker: the line's stops in order, or at the photo. */
function StationSelect({ label, stops, value, disabled, onChange }: StationSelectProps) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="border-input bg-background h-8 rounded-md border px-2"
        value={stopIndex(stops, value)}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : stopPoint(stops[+e.target.value]!))
        }
      >
        <option value="">At the photo</option>
        {stops.map((s, i) => (
          <option key={i} value={i}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
