import { Plus } from "lucide-react";
import { useState } from "react";
import { useTripLinesSearch } from "@/lib/trip-lines-search";
import type { CombinedData } from "@/api/photos";
import { timelineLabels } from "@/api/timeline-labels";
import { type Trip, trips } from "@/api/trips";
import { dayTitle } from "@/components/trip-lines/day-title";
import { TripEditor } from "@/components/trips/trip-editor";
import { TripFromLabel } from "@/components/trips/trip-from-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripDay } from "@/lib/trip-days";
import { cn } from "@/lib/utils";

/** A new Trip with no name, days or legs yet. */
const NEW_TRIP: Trip = { id: "", name: "", start: "", end: "", legs: [] };

/** The Trips listed on the left, newest first, and the chosen one, or a new one, edited on the right. */
export function TripsPanel({ data, days }: { data: CombinedData; days: TripDay[] }) {
  const all = trips(data);
  const { search, set } = useTripLinesSearch();
  // A new Trip not saved yet, which has no ID for the URL.
  const [draft, setDraft] = useState<Trip>();
  const trip = draft ?? chosenTrip(all, search.trip);
  const setChosen = (chosen: string | Trip | undefined) => {
    setDraft(typeof chosen === "object" ? chosen : undefined);
    set({ trip: typeof chosen === "string" ? chosen : undefined });
  };
  const byDay = new Map(days.map((d) => [d.day, d]));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <TripList
        trips={all}
        chosen={trip?.id}
        onChoose={setChosen}
        onNew={setChosen}
        labels={timelineLabels(data)}
      />
      {trip ? (
        <TripEditor
          key={editorKey(trip)}
          trip={trip}
          others={all.filter((t) => t.id !== trip.id)}
          days={byDay}
          onSaved={setChosen}
          onRemoved={() => setChosen(undefined)}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          A Trip groups a run of days and adds the legs between them, such as a ferry or a flight.
          Start one with <strong>New Trip</strong>.
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
  return trip.id || `new-${trip.name}-${trip.start}`;
}

interface TripListProps {
  trips: Trip[];
  chosen: string | undefined;
  onChoose: (id: string) => void;
  onNew: (trip: Trip) => void;
  labels: ReturnType<typeof timelineLabels>;
}

function TripList({ trips: all, chosen, onChoose, onNew, labels }: TripListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trips</CardTitle>
        <CardDescription>Runs of days, with the legs travelled between them.</CardDescription>
        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onNew(NEW_TRIP)}
          >
            <Plus />
            New Trip
          </Button>
          <TripFromLabel labels={labels} onPick={onNew} />
        </div>
      </CardHeader>
      <CardContent className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto">
        {all.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
        {all.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChoose(t.id)}
            aria-current={t.id === chosen}
            className={cn(
              "hover:bg-muted flex flex-col rounded-md px-2 py-1.5 text-left text-sm",
              t.id === chosen && "bg-muted font-medium",
            )}
          >
            <span className="truncate">{t.name}</span>
            <span className="text-muted-foreground text-xs font-normal">
              {dayTitle(t.start)} to {dayTitle(t.end)}, {t.legs.length} legs
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
