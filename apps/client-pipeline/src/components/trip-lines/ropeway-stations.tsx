import { MapPin, X } from "lucide-react";
import type { TripPoint, TripSegment } from "@/api/trip-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isRopeway, type RopewaySide } from "@/lib/ropeway-ends";

interface StationPickProps {
  /** Which side's station the map is waiting to have clicked, if either. */
  picking?: RopewaySide;
  /** Waits for a click on the map to place the side's station, or stops waiting with undefined. */
  onPicking: (side: RopewaySide | undefined) => void;
  /** Renames the side's station, or puts it back at the photo with undefined. */
  onStation: (side: RopewaySide, station: TripPoint | undefined) => void;
}

interface RopewayStationsProps extends StationPickProps {
  /** The hop; only a ropeway named by hand shows its stations. */
  hop: TripSegment;
}

/**
 * Where a ropeway or gondola started and ended, each placed by clicking the map: it's drawn as a
 * straight line between them, with a walk to and from the photos. "At the photo" runs right from or to
 * it.
 */
export function RopewayStations({ hop, ...props }: RopewayStationsProps) {
  if (!isRopeway(hop)) return null;
  const { board, alight } = hop;
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <RopewayStation title="Starts at" side="start" station={board} {...props} />
      <RopewayStation title="Ends at" side="end" station={alight} {...props} />
    </div>
  );
}

interface RopewayStationProps extends StationPickProps {
  title: string;
  side: RopewaySide;
  station?: TripPoint;
}

/** One station: its name with a way back to the photo, and a button that places it on the map. */
function RopewayStation({
  title,
  side,
  station,
  picking,
  onPicking,
  onStation,
}: RopewayStationProps) {
  const active = picking === side;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground">{title}</span>
      <div className="flex items-center gap-1">
        <StationName title={title} station={station} onStation={(next) => onStation(side, next)} />
        <Button
          variant={active ? "secondary" : "outline"}
          size="sm"
          onClick={() => onPicking(active ? undefined : side)}
        >
          <MapPin aria-hidden />
          {pickLabel(active, station)}
        </Button>
      </div>
    </div>
  );
}

/** What the button that places a station says: waiting for the click, or moving or placing it. */
function pickLabel(active: boolean, station: TripPoint | undefined): string {
  if (active) return "Click the map…";
  return station ? "Move" : "On the map";
}

interface StationNameProps {
  title: string;
  station?: TripPoint;
  /** Renames the station, or puts it back at the photo with undefined. */
  onStation: (station: TripPoint | undefined) => void;
}

/** A station's name to change and a way back to the photo, or "At the photo" when none is placed. */
function StationName({ title, station, onStation }: StationNameProps) {
  if (!station) return <span className="text-muted-foreground flex-1">At the photo</span>;
  return (
    <>
      <Input
        value={station.label ?? ""}
        placeholder="Sanroku Station"
        aria-label={`${title}: the station's name`}
        className="h-8 min-w-0 flex-1"
        onChange={(e) => onStation({ ...station, label: e.target.value })}
      />
      <Button
        variant="ghost"
        size="sm"
        title="Start or end at the photo instead"
        onClick={() => onStation(undefined)}
      >
        <X aria-hidden />
        The photo
      </Button>
    </>
  );
}
