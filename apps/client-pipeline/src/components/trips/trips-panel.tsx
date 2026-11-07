import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { CombinedData } from "@/api/photos";
import { legacyTripIds, photosBetween, type Trip, trips } from "@/api/trips";
import { dayRange } from "@/components/trips/day-range";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { shownPhotos } from "@/lib/place-seeds";

/** The ID in a Trip page's URL for a new Trip, not saved yet. */
export const NEW_TRIP_ID = "new";

/** The Trip Lines page's Trips tab: every Trip, newest first, each linking to its own page. */
export function TripsPanel({ data }: { data: CombinedData }) {
  const all = trips(data);
  const photos = shownPhotos(data);
  const legacy = legacyTripIds(data);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          A Trip names a run of days on the Timeline, adds the legs between them, such as a ferry or
          a flight, and gathers its days' stories into its Trip page.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/trip-lines/trips/$id" params={{ id: NEW_TRIP_ID }}>
            <Plus />
            New Trip
          </Link>
        </Button>
      </div>
      {all.length === 0 && <p className="text-muted-foreground text-sm">No Trips yet.</p>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((trip) => (
          <li key={trip.id}>
            <TripCard
              trip={trip}
              photos={photosBetween(photos, trip.start, trip.end)}
              legacy={legacy.has(trip.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
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
}

/** One Trip on the tab: its name, days, legs and photos, linking to its page. */
function TripCard({ trip, photos, legacy }: TripCardProps) {
  return (
    <Link
      to="/trip-lines/trips/$id"
      params={{ id: trip.id }}
      className="hover:ring-ring block h-full rounded-xl hover:ring-2"
    >
      <Card className="h-full">
        <CardHeader>
          <CardTitle>{trip.name}</CardTitle>
          <CardDescription className="flex flex-col gap-0.5">
            <span>{dayRange(trip.start, trip.end)}</span>
            <span>
              {photosText(photos)} · {legsText(trip.legs.length)}
            </span>
            {legacy && (
              <span className="text-amber-700 dark:text-amber-400">
                Save to show on the Timeline
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
