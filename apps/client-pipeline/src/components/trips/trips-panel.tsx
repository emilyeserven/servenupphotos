import { Plus } from "lucide-react";
import { useState } from "react";
import type { CombinedData } from "@/api/photos";
import { legacyTripIds, photosBetween, type Trip, trips } from "@/api/trips";
import { dayRange } from "@/components/trips/day-range";
import { TripEditor } from "@/components/trips/trip-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { shownPhotos } from "@/lib/place-seeds";
import type { TripDay } from "@/lib/trip-days";
import { useTripsSearch } from "@/lib/trips-search";
import { cn } from "@/lib/utils";

/** A new Trip with no name, days or legs yet. */
const NEW_TRIP: Trip = { id: "", name: "", start: "", end: "", legs: [] };

/** How many saved photos were taken on a day from start to end. */
type CountPhotos = (start: string, end: string) => number;

/** The Trips listed on the left, newest first, and the chosen one, or a new one, edited on the right. */
export function TripsPanel({ data, days }: { data: CombinedData; days: TripDay[] }) {
  const all = trips(data);
  const { search, set } = useTripsSearch();
  // A new Trip not saved yet, which has no ID for the URL.
  const [draft, setDraft] = useState<Trip>();
  const trip = draft ?? chosenTrip(all, search.trip);
  const setChosen = (chosen: string | Trip | undefined) => {
    setDraft(typeof chosen === "object" ? chosen : undefined);
    set({ trip: typeof chosen === "string" ? chosen : undefined });
  };
  const photos = shownPhotos(data);
  const countPhotos: CountPhotos = (start, end) => photosBetween(photos, start, end);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <TripList
        trips={all}
        chosen={trip?.id}
        countPhotos={countPhotos}
        onChoose={setChosen}
        onNew={() => setChosen(NEW_TRIP)}
      />
      {trip ? (
        <TripEditor
          key={editorKey(trip)}
          trip={trip}
          others={all.filter((t) => t.id !== trip.id)}
          days={new Map(days.map((d) => [d.day, d]))}
          countPhotos={countPhotos}
          legacy={legacyTripIds(data).has(trip.id)}
          onSaved={setChosen}
          onRemoved={() => setChosen(undefined)}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          A Trip names a run of days on the Timeline and adds the legs between them, such as a ferry
          or a flight. Start one with <strong>New Trip</strong>.
        </p>
      )}
    </div>
  );
}

/** The saved Trip the URL names, or else the newest. */
function chosenTrip(all: Trip[], id: string | undefined): Trip | undefined {
  return all.find((t) => t.id === id) ?? all[0];
}

/** A key that starts the editor afresh for another Trip, or another new one. */
function editorKey(trip: Trip): string {
  return trip.id || "new";
}

interface TripListProps {
  trips: Trip[];
  chosen: string | undefined;
  countPhotos: CountPhotos;
  onChoose: (id: string) => void;
  onNew: () => void;
}

function TripList({ trips: all, chosen, countPhotos, onChoose, onNew }: TripListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trips</CardTitle>
        <CardDescription>
          Newest first, with how many photos were taken on their days.
        </CardDescription>
        <Button
          variant="outline"
          size="sm"
          className="mt-1 self-start"
          disabled={chosen === ""}
          onClick={onNew}
        >
          <Plus />
          New Trip
        </Button>
      </CardHeader>
      <CardContent className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
        {all.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
        {all.map((t) => (
          <TripRow
            key={t.id}
            trip={t}
            chosen={t.id === chosen}
            photos={countPhotos(t.start, t.end)}
            onChoose={() => onChoose(t.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

/** "1 leg" or "3 legs"; "" with none. */
function legsText(n: number): string {
  if (n === 0) return "";
  return n === 1 ? ", 1 leg" : `, ${n} legs`;
}

interface TripRowProps {
  trip: Trip;
  chosen: boolean;
  photos: number;
  onChoose: () => void;
}

function TripRow({ trip, chosen, photos, onChoose }: TripRowProps) {
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-current={chosen}
      className={cn(
        "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
        chosen && "bg-muted font-medium",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{trip.name}</span>
        <span className="text-muted-foreground text-xs font-normal">
          {dayRange(trip.start, trip.end)}
          {legsText(trip.legs.length)}
        </span>
      </span>
      <span className="text-muted-foreground shrink-0 text-xs">{photos}</span>
    </button>
  );
}
