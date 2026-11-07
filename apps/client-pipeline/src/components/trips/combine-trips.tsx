import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { combinedTrip, combineTripsMutation, overlappingTrip, type Trip } from "@/api/trips";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { dayRange } from "@/components/trips/day-range";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labelsProblem } from "@/lib/trip-labels";

interface CombineBarProps {
  /** The Trips picked to combine, in any order. */
  picked: Trip[];
  /** Every Trip, to check the combined one doesn't cover another's days. */
  all: Trip[];
  onCancel: () => void;
}

/** The picked Trips' names joined, such as "Korea and Japan", oldest first. */
function joinedName(picked: Trip[]): string {
  const names = picked.toSorted((a, b) => a.start.localeCompare(b.start)).map((t) => t.name);
  return [...new Set(names)].join(" and ");
}

/** Another Trip within the combined one's days that isn't picked, as a sentence; "" with none. */
function clashNote(trip: Trip, picked: Trip[], all: Trip[]): string {
  const clash = overlappingTrip(
    all.filter((t) => !picked.includes(t)),
    trip,
  );
  if (!clash) return "";
  return `“${clash.name}” (${dayRange(clash.start, clash.end)}) is within these days too. Pick it as well.`;
}

/** Why the picked Trips can't be combined yet; "" when they can. */
function whyNot(trip: Trip | undefined, picked: Trip[], all: Trip[]): string {
  if (!trip) return "Pick two or more Trips to combine.";
  if (!trip.name.trim()) return "Give the combined Trip a name.";
  return labelsProblem(trip) || clashNote(trip, picked, all);
}

/**
 * Combining Trips: the name of the one they become, and what it covers. Each Trip becomes a timeline
 * label on its days (or keeps its own labels), so the Timeline still shows "Korea", then "Japan".
 */
export function CombineBar({ picked, all, onCancel }: CombineBarProps) {
  const [typed, setName] = useState<string>();
  const name = typed ?? joinedName(picked);
  const trip = picked.length >= 2 ? combinedTrip(name.trim(), picked) : undefined;
  const why = whyNot(trip, picked, all);
  return (
    <div className="bg-muted/50 flex flex-col gap-3 rounded-md border p-3">
      <p className="text-sm">
        Pick the Trips to combine. They become one Trip, with one Trip page and their legs together,
        and each keeps its name on its days as a timeline label.
        {trip && <> The new Trip covers {dayRange(trip.start, trip.end)}.</>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          placeholder="Korea and Japan"
          aria-label="The combined Trip's name"
          className="max-w-xs"
          onChange={(e) => setName(e.target.value)}
        />
        <CombineButton trip={trip} picked={picked} why={why} />
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface CombineButtonProps {
  trip: Trip | undefined;
  picked: Trip[];
  why: string;
}

/** Combines the picked Trips, then opens the combined one's page. */
function CombineButton({ trip, picked, why }: CombineButtonProps) {
  const navigate = useNavigate();
  const combine = useMutation({
    ...combineTripsMutation,
    onSuccess: (_, { trip: saved }) =>
      void navigate({ to: "/trip-lines/trips/$id", params: { id: saved.id } }),
  });
  return (
    <>
      <Button
        disabled={why !== "" || combine.isPending}
        onClick={() => trip && combine.mutate({ trip, ids: picked.map((t) => t.id) })}
      >
        <Busy busy={combine.isPending} />
        Combine {picked.length} Trips
      </Button>
      <SaveNote error={combine.error} why={why} />
    </>
  );
}
