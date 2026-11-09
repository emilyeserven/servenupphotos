import { TrainFront, X } from "lucide-react";
import type { HopAsk, Spot } from "@/api/transit";
import type { TripPoint } from "@/api/trip-lines";
import { StationSearch } from "@/components/trips/station-search";
import type { HopEnds } from "@/components/trip-lines/use-hop-ride";
import { Button } from "@/components/ui/button";

interface HopEndsPickerProps {
  /** The hop's photos' spots, which stations are found near; none when a photo is missing. */
  ask?: HopAsk;
  /** The kind of line looked for, such as "train", whose stations are found; none until picked. */
  kind?: string;
  /** Whether to offer stations at all: once nothing was found near the photos, or one is picked. */
  shown: boolean;
  ends: HopEnds;
  onEnds: (ends: HopEnds) => void;
}

/**
 * The stations to look for lines near instead of the hop's photos, for when a photo was a walk from
 * the line: say from the beach to the end of the line. Found by name, as on a Trip's legs.
 */
export function HopEndsPicker({ ask, kind, shown, ends, onEnds }: HopEndsPickerProps) {
  if (!shown || !ask || !kind) return null;
  return <EndsPicker kind={kind} ends={ends} near={[ask.from, ask.to]} onEnds={onEnds} />;
}

interface EndsPickerProps {
  kind: string;
  ends: HopEnds;
  near: [Spot, Spot];
  onEnds: (ends: HopEnds) => void;
}

/** Where the hop got on and off, each a station search near its photo. */
function EndsPicker({ kind, ends, near, onEnds }: EndsPickerProps) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <HopEnd
        title="Got on near"
        kind={kind}
        near={near[0]}
        station={ends.board}
        onStation={(board) => onEnds({ ...ends, board })}
      />
      <HopEnd
        title="Got off near"
        kind={kind}
        near={near[1]}
        station={ends.alight}
        onStation={(alight) => onEnds({ ...ends, alight })}
      />
    </div>
  );
}

interface HopEndProps {
  title: string;
  kind: string;
  near: Spot;
  station?: TripPoint;
  onStation: (station?: TripPoint) => void;
}

/** One end: the station picked with a way back to the photo, or else a search for one. */
function HopEnd({ title, kind, near, station, onStation }: HopEndProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground">{title}</span>
      {station ? (
        <div className="flex items-center gap-2">
          <TrainFront className="text-muted-foreground size-3.5" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{station.label}</span>
          <Button variant="ghost" size="sm" onClick={() => onStation(undefined)}>
            <X aria-hidden />
            The photo
          </Button>
        </div>
      ) : (
        <StationSearch title={title} mode={kind} near={near} onPick={onStation} />
      )}
    </div>
  );
}
