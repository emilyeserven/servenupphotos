import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  deleteTripMutation,
  overlappingTrip,
  saveTripMutation,
  type Trip,
  type TripLeg,
  tripId,
} from "@/api/trips";
import { Busy, RemoveEntryButton, SaveNote } from "@/components/entry-buttons";
import { dayRange } from "@/components/trips/day-range";
import { LegRow } from "@/components/trips/leg-row";
import { TripFields } from "@/components/trips/trip-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripDay } from "@/lib/trip-days";
import { datesBetween } from "@/lib/trip-legs";

interface TripEditorProps {
  /** The Trip as saved, or a new one with no ID yet. */
  trip: Trip;
  /** The other Trips, whose days it can't share. */
  others: Trip[];
  /** The days with photos at an exact spot, by day, which legs leave from and arrive at. */
  days: Map<string, TripDay>;
  /** How many saved photos were taken on a day from start to end. */
  countPhotos: (start: string, end: string) => number;
  /** Whether it's still in the trip lines folder from before, so saving it moves it. */
  legacy: boolean;
  onSaved: (id: string) => void;
  onRemoved: () => void;
}

/** A new leg after the others: a ferry from the day the last one arrived, or the Trip's first day, to the next. */
function nextLeg(trip: Trip, dates: string[]): TripLeg {
  const from = trip.legs.at(-1)?.to.day ?? trip.start;
  const to = dates.find((d) => d > from) ?? from;
  return { mode: "ferry", from: { day: from }, to: { day: to } };
}

/** The draft with its last day the first when it's left empty, as it will be saved. */
function withDays(draft: Trip): Trip {
  return { ...draft, name: draft.name.trim(), end: draft.end || draft.start };
}

/** The days the Trip covers and how many photos were taken on them, once its first day is picked. */
function Covers({ trip, countPhotos }: Pick<TripEditorProps, "trip" | "countPhotos">) {
  if (!trip.start) return <>Pick the days it covers. Each day can be in one Trip.</>;
  const count = countPhotos(trip.start, trip.end);
  return (
    <>
      {dayRange(trip.start, trip.end)}: {count} saved {count === 1 ? "photo" : "photos"} taken then.
    </>
  );
}

/** A Trip's name, days and legs, edited as a draft and saved as a change waiting for Commit. */
export function TripEditor(props: TripEditorProps) {
  const { trip, days } = props;
  const [typed, setDraft] = useState(trip);
  const draft = withDays(typed);
  const dates = datesBetween(draft.start, draft.end);
  const setLeg = (i: number, leg?: TripLeg) =>
    setDraft({ ...typed, legs: typed.legs.flatMap((l, j) => (j !== i ? [l] : leg ? [leg] : [])) });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{trip.name || "New Trip"}</CardTitle>
        <CardDescription>
          <Covers trip={draft} countPhotos={props.countPhotos} />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LegacyNote legacy={props.legacy} />
        <TripFields trip={typed} onChange={setDraft} />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Legs between days</h3>
          <p className="text-muted-foreground text-sm">
            Optional: the ferries and flights a day's line can't hold, drawn on the map. Days can be
            skipped, such as a flight out on the first day and home on the last.
          </p>
        </div>
        <ol className="flex flex-col gap-3 empty:hidden">
          {draft.legs.map((leg, i) => (
            <LegRow
              // Legs have no ID of their own; their order is what they are.
              // oxlint-disable-next-line react/no-array-index-key
              key={i}
              leg={leg}
              n={i + 1}
              dates={dates}
              days={days}
              onChange={(next) => setLeg(i, next)}
              onRemove={() => setLeg(i)}
            />
          ))}
        </ol>
        <Button
          variant="outline"
          className="self-start"
          disabled={dates.length === 0}
          onClick={() => setDraft({ ...typed, legs: [...typed.legs, nextLeg(draft, dates)] })}
        >
          <Plus />
          Add a leg
        </Button>
        <TripActions
          draft={draft}
          saved={props.legacy ? NEW_SAVE : trip}
          why={whyNotSaved(draft, props.others)}
          onSaved={props.onSaved}
          onRemoved={props.onRemoved}
        />
      </CardContent>
    </Card>
  );
}

/** A saved Trip to compare with that never matches, so a Trip from before can be saved as it is. */
const NEW_SAVE: Trip = { id: "", name: "", start: "", end: "", legs: [] };

/** Says a Trip from before isn't on the Timeline until it's saved again. */
function LegacyNote({ legacy }: { legacy: boolean }) {
  if (!legacy) return null;
  return (
    <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      This Trip was saved with the trip lines, before Trips and timeline labels became one thing, so
      the Timeline doesn't show it yet. <strong>Save Trip</strong> moves it to TIMELINE.json.
    </p>
  );
}

/** What the draft is missing, such as its name; "" with nothing. */
function missingField(draft: Trip): string {
  if (!draft.name) return "Give the Trip a name.";
  if (!draft.start) return "Pick its first day.";
  return draft.end < draft.start ? "The last day is before the first." : "";
}

/** Why the draft can't be saved yet; "" when it can. */
function whyNotSaved(draft: Trip, others: Trip[]): string {
  const missing = missingField(draft);
  if (missing) return missing;
  const clash = overlappingTrip(others, draft);
  return clash ? `“${clash.name}” already covers ${dayRange(clash.start, clash.end)}.` : "";
}

interface TripActionsProps {
  draft: Trip;
  saved: Trip;
  why: string;
  onSaved: (id: string) => void;
  onRemoved: () => void;
}

function TripActions({ draft, saved, why, onSaved, onRemoved }: TripActionsProps) {
  const save = useMutation({ ...saveTripMutation, onSuccess: (_, trip) => onSaved(trip.id) });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={save.isPending || isBlocked(draft, saved, why)}
        onClick={() => save.mutate(withTripId(draft))}
      >
        <Busy busy={save.isPending} />
        Save Trip
      </Button>
      <SaveNote error={save.error} why={why} />
      <RemoveTrip id={draft.id} onRemoved={onRemoved} />
    </div>
  );
}

/** Whether there's nothing to save: no change to a saved Trip, or a reason it can't be. */
function isBlocked(draft: Trip, saved: Trip, why: string): boolean {
  const unchanged = saved.id !== "" && JSON.stringify(draft) === JSON.stringify(saved);
  return unchanged || why !== "";
}

/** The draft with an ID, made from its name and first day when it's new. */
function withTripId(draft: Trip): Trip {
  return { ...draft, id: draft.id || tripId(draft.name, draft.start) };
}

/** Removes a saved Trip; nothing for a new one. */
function RemoveTrip({ id, onRemoved }: { id: string; onRemoved: () => void }) {
  if (!id) return null;
  return <RemoveSavedTrip id={id} onRemoved={onRemoved} />;
}

function RemoveSavedTrip({ id, onRemoved }: { id: string; onRemoved: () => void }) {
  const remove = useMutation({ ...deleteTripMutation, onSuccess: onRemoved });
  return (
    <RemoveEntryButton
      label="Remove Trip"
      remove={{ ...remove, mutate: () => remove.mutate(id) }}
    />
  );
}
