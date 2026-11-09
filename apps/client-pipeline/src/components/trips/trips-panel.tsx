import { Link } from "@tanstack/react-router";
import { Combine, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { CombinedData } from "@/api/photos";
import { tripLines } from "@/api/trip-lines";
import { legacyTripIds, photosBetween, type Trip, trips } from "@/api/trips";
import { CombineBar } from "@/components/trips/combine-trips";
import { dayRange } from "@/components/trips/day-range";
import { type DayLines, TripPreview } from "@/components/trips/trip-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { shownPhotos } from "@/lib/place-seeds";
import { lineDays } from "@/lib/stale-trip-lines";

/** The ID in a Trip page's URL for a new Trip, not saved yet. */
export const NEW_TRIP_ID = "new";

/** The Trip Lines page's Trips tab: every Trip, newest first, each linking to its own page. */
export function TripsPanel({ data }: { data: CombinedData }) {
  const all = trips(data);
  const photos = shownPhotos(data);
  const legacy = legacyTripIds(data);
  const dayLines = useMemo(() => dayLinesOf(data), [data]);
  // The IDs of the Trips picked to combine, or undefined while not combining.
  const [picked, setPicked] = useState<Set<string>>();
  const toggle = (id: string) => setPicked(toggled(picked ?? new Set(), id));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          A Trip names a run of days on the Timeline, adds the legs between them, such as a ferry or
          a flight, and gathers its days' stories into its Trip page.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={picked !== undefined || all.length < 2}
            onClick={() => setPicked(new Set())}
          >
            <Combine />
            Combine Trips
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/trip-lines/trips/$id" params={{ id: NEW_TRIP_ID }}>
              <Plus />
              New Trip
            </Link>
          </Button>
        </div>
      </div>
      {picked && (
        <CombineBar
          picked={all.filter((t) => picked.has(t.id))}
          all={all}
          onCancel={() => setPicked(undefined)}
        />
      )}
      {all.length === 0 && <p className="text-muted-foreground text-sm">No Trips yet.</p>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((trip) => (
          <li key={trip.id}>
            <TripCard
              trip={trip}
              photos={photosBetween(photos, trip.start, trip.end)}
              legacy={legacy.has(trip.id)}
              dayLines={dayLines}
              picked={picked && { on: picked.has(trip.id), toggle: () => toggle(trip.id) }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Every day's line and photos, read once for all the Trips' previews. */
function dayLinesOf(data: CombinedData): DayLines {
  return { lines: tripLines(data), days: new Map(lineDays(data).map((d) => [d.day, d])) };
}

/** The set with the ID added, or taken out when it's there. */
function toggled(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** "2 labels: Korea, Japan"; "" with none. */
function labelsText(trip: Trip): string {
  if (trip.labels.length === 0) return "";
  return `Labels: ${trip.labels.map((l) => l.name).join(", ")}`;
}

/** "2 legs"; "No legs" with none. */
function legsText(n: number): string {
  if (n === 0) return "No legs";
  return n === 1 ? "1 leg" : `${n} legs`;
}

/** "53 photos". */
function photosText(n: number): string {
  return n === 1 ? "1 photo" : `${n} photos`;
}

interface TripCardProps {
  trip: Trip;
  photos: number;
  /** Whether it's still in the trip lines folder from before, so the Timeline doesn't show it yet. */
  legacy: boolean;
  /** Every day's line and photos, for the map preview of the Trip's lines. */
  dayLines: DayLines;
  /** While combining, whether it's picked and how to pick it; the card then picks rather than links. */
  picked?: { on: boolean; toggle: () => void };
}

const CARD_LINK = "hover:ring-ring block h-full w-full rounded-xl text-left hover:ring-2";

/** One Trip on the tab, linking to its page, or picking it while combining. */
function TripCard({ picked, ...props }: TripCardProps) {
  if (picked) {
    return (
      <button
        type="button"
        aria-pressed={picked.on}
        onClick={picked.toggle}
        className={`${CARD_LINK} ${picked.on ? "ring-primary ring-2" : ""}`}
      >
        <TripCardBody {...props} />
      </button>
    );
  }
  return (
    <Link to="/trip-lines/trips/$id" params={{ id: props.trip.id }} className={CARD_LINK}>
      <TripCardBody {...props} />
    </Link>
  );
}

/** A Trip's name, days, photos and legs, its timeline labels, and a map preview of its lines. */
function TripCardBody({ trip, photos, legacy, dayLines }: Omit<TripCardProps, "picked">) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{trip.name}</CardTitle>
        <CardDescription className="flex flex-col gap-0.5">
          <span>{dayRange(trip.start, trip.end)}</span>
          <span>
            {photosText(photos)} · {legsText(trip.legs.length)}
          </span>
          {trip.labels.length > 0 && <span>{labelsText(trip)}</span>}
          {legacy && (
            <span className="text-amber-700 dark:text-amber-400">Save to show on the Timeline</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TripPreview trip={trip} dayLines={dayLines} />
      </CardContent>
    </Card>
  );
}
