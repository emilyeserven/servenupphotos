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
  onSaved: (id: string) => void;
  onRemoved: () => void;
}

/** A new leg after the others: a ferry from the day the last one arrived, or the Trip's first day, to the next. */
function nextLeg(trip: Trip, dates: string[]): TripLeg {
  const from = trip.legs.at(-1)?.to.day ?? trip.start;
  const to = dates.find((d) => d > from) ?? from;
  return { mode: "ferry", from: { day: from }, to: { day: to } };
}

/** A Trip's name, days and legs, edited as a draft and saved as a change waiting for Commit. */
export function TripEditor({ trip, others, days, onSaved, onRemoved }: TripEditorProps) {
  const [draft, setDraft] = useState(trip);
  const dates = datesBetween(draft.start, draft.end);
  const setLeg = (i: number, leg?: TripLeg) =>
    setDraft({ ...draft, legs: draft.legs.flatMap((l, j) => (j !== i ? [l] : leg ? [leg] : [])) });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{draft.name || "New Trip"}</CardTitle>
        <CardDescription>
          The legs between days that a day's line can't hold, such as a ferry or a flight. Days can
          be skipped, such as a flight out on the first day and home on the last.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TripFields trip={draft} onChange={setDraft} />
        <ol className="flex flex-col gap-3">
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
          onClick={() => setDraft({ ...draft, legs: [...draft.legs, nextLeg(draft, dates)] })}
        >
          <Plus />
          Add a leg
        </Button>
        <TripActions
          draft={draft}
          saved={trip}
          why={whyNotSaved(draft, others)}
          onSaved={onSaved}
          onRemoved={onRemoved}
        />
      </CardContent>
    </Card>
  );
}

/** Why the draft can't be saved yet; "" when it can. */
function whyNotSaved(draft: Trip, others: Trip[]): string {
  if (!draft.name.trim()) return "Give the Trip a name.";
  if (datesBetween(draft.start, draft.end).length === 0) return "Pick its first and last days.";
  const clash = overlappingTrip(others, draft);
  return clash ? `"${clash.name}" already covers some of these days.` : "";
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
      <RemoveTrip id={saved.id} onRemoved={onRemoved} />
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
