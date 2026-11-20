import { TripRow } from "@/components/map-trip-row";
import { PickerPart } from "@/components/section-picker";
import { Button } from "@/components/ui/button";
import type { MapDisplay } from "@/lib/map-display";
import type { PlacedPhoto } from "@/lib/map-photos";
import { type MapTrip, mapTrips } from "@/lib/map-trips";
import { useTripLinesOnDays } from "@/lib/trip-lines-map";

/**
 * The Trip tab of the map's Places menu: a checkbox for each Trip with trip lines on the days of
 * the map's photos, newest first, which shows or hides that Trip's lines (its walks, rides, train
 * and other legs), with the days in no Trip last. Each opens to a checkbox for each of its days. While trip lines are off in the display options,
 * it says so, with a button to turn them on.
 */
export function MapTripToggles({
  photos,
  display,
  onDisplayChange,
}: {
  /** The photos the map draws, whose days' trip lines are listed by Trip. */
  photos: PlacedPhoto[];
  display: MapDisplay;
  onDisplayChange: (change: Partial<MapDisplay>) => void;
}) {
  const map = useTripLinesOnDays(photos, true);
  return (
    <PickerPart intro="Show or hide each trip's lines on the map, or open one for its days.">
      {!display.tripLines && <LinesOff onTurnOn={() => onDisplayChange({ tripLines: true })} />}
      <TripList
        trips={map && mapTrips(map)}
        hidden={display.hiddenTrips}
        onHiddenChange={(hiddenTrips) => onDisplayChange({ hiddenTrips })}
      />
    </PickerPart>
  );
}

/**
 * The Trips' checkboxes with **Show all** and **Hide all** under them, or a note while they load
 * or when there are none.
 */
function TripList({
  trips,
  hidden,
  onHiddenChange,
}: {
  /** The Trips with lines on the map; undefined while they load. */
  trips: MapTrip[] | undefined;
  /** The hidden Trips' IDs and days' `dayKey`s. */
  hidden: string[];
  onHiddenChange: (hidden: string[]) => void;
}) {
  if (!trips) return <Note text="Loading trips…" />;
  if (trips.length === 0) return <Note text="No trip lines for the photos on the map." />;
  return (
    <>
      <ul className="flex flex-col gap-1" aria-label="Trips">
        {trips.map((trip) => (
          <TripRow
            key={trip.id}
            trip={trip}
            hidden={hidden}
            onToggle={(key, shown) => onHiddenChange(toggled(hidden, key, shown))}
          />
        ))}
      </ul>
      <AllButtons
        onShowAll={() => onHiddenChange([])}
        onHideAll={() => onHiddenChange(trips.map((trip) => trip.id))}
      />
    </>
  );
}

/** The hidden Trips and days with one shown or hidden. */
function toggled(hidden: string[], id: string, shown: boolean): string[] {
  const others = hidden.filter((each) => each !== id);
  return shown ? others : [...others, id];
}

/** **Show all** and **Hide all**, under the list. */
function AllButtons({ onShowAll, onHideAll }: { onShowAll: () => void; onHideAll: () => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onShowAll}>
        Show all
      </Button>
      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onHideAll}>
        Hide all
      </Button>
    </div>
  );
}

/** Says trip lines are off in the display options, with a button turning them on. */
function LinesOff({ onTurnOn }: { onTurnOn: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
      <span className="flex-1 text-muted-foreground">Trip lines are off in Display Options.</span>
      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onTurnOn}>
        Turn on
      </Button>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{text}</p>;
}
