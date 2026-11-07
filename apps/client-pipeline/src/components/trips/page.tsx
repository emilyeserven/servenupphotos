import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { CombinedData } from "@/api/photos";
import { legacyTripIds, photosBetween, type Trip, trips } from "@/api/trips";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { dayTitle } from "@/components/trip-lines/day-title";
import { TripEditor } from "@/components/trips/trip-editor";
import { NEW_TRIP_ID } from "@/components/trips/trips-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { shownPhotos } from "@/lib/place-seeds";
import { lineDays } from "@/lib/stale-trip-lines";
import type { TripDay } from "@/lib/trip-days";
import { useCombinedData } from "@/stores/combined-data";

/** A new Trip with no name, days or legs yet. */
const NEW_TRIP: Trip = { id: "", name: "", start: "", end: "", legs: [] };

/** One Trip's page, from the Trip Lines page's Trips tab: its name, days and legs, and its days' lines. */
export function TripPage({ id }: { id: string }) {
  const combined = useCombinedData();
  const trip = trips(combined.data).find((t) => t.id === id);
  return (
    <Page
      wide
      title={trip?.name ?? "New Trip"}
      description="A Trip names a run of days, which the portfolio's Timeline shows beside them. Its legs, such as a ferry or a flight, are drawn on the map between its days, and its days' stories make up its Trip page."
      action={<BackToTrips />}
    >
      <GitHubGate>{() => <TripContent id={id} />}</GitHubGate>
    </Page>
  );
}

function BackToTrips() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/trip-lines" search={{ tab: "trips" }}>
        <ArrowLeft />
        All Trips
      </Link>
    </Button>
  );
}

function TripContent({ id }: { id: string }) {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and Trips…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <TripDetail id={id} data={combined.data} />;
}

/** The Trip the URL names, or a new one, edited beside the list of its days. */
function TripDetail({ id, data }: { id: string; data: CombinedData }) {
  const navigate = useNavigate();
  const all = trips(data);
  const trip = id === NEW_TRIP_ID ? NEW_TRIP : all.find((t) => t.id === id);
  if (!trip)
    return <p className="text-muted-foreground text-sm">There's no Trip with the ID “{id}”.</p>;
  const photos = shownPhotos(data);
  const days = lineDays(data);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <TripEditor
        key={trip.id || NEW_TRIP_ID}
        trip={trip}
        others={all.filter((t) => t.id !== trip.id)}
        days={new Map(days.map((d) => [d.day, d]))}
        countPhotos={(start, end) => photosBetween(photos, start, end)}
        legacy={legacyTripIds(data).has(trip.id)}
        onSaved={(saved) =>
          void navigate({ to: "/trip-lines/trips/$id", params: { id: saved }, replace: true })
        }
        onRemoved={() => void navigate({ to: "/trip-lines", search: { tab: "trips" } })}
      />
      <TripDays trip={trip} days={days} />
    </div>
  );
}

/** The Trip's days that can have a line, each linking to it on the Days tab. */
function TripDays({ trip, days }: { trip: Trip; days: TripDay[] }) {
  if (!trip.id) return null;
  const inTrip = days.filter((d) => d.day >= trip.start && d.day <= trip.end).toReversed();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Its days</CardTitle>
        <CardDescription>
          The days with photos at an exact spot, to mark their lines and stories.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {inTrip.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
        {inTrip.map((d) => (
          <Link
            key={d.day}
            to="/trip-lines"
            search={{ day: d.day }}
            className="hover:bg-muted flex justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
          >
            <span>{dayTitle(d.day)}</span>
            <span className="text-muted-foreground text-xs">{d.photos.length} photos</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
