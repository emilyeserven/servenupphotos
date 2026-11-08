import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { CombinedData } from "@/api/photos";
import { legacyTripIds, photosBetween, type Trip, trips } from "@/api/trips";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { tripLines } from "@/api/trip-lines";
import { TripEditor } from "@/components/trips/trip-editor";
import { NEW_TRIP_ID } from "@/components/trips/trips-panel";
import { Button } from "@/components/ui/button";
import { shownPhotos } from "@/lib/place-seeds";
import { lineDays } from "@/lib/stale-trip-lines";
import { useSessionData } from "@/hooks/use-session-data";

/** A new Trip with no name, days or legs yet. */
const NEW_TRIP: Trip = { id: "", name: "", start: "", end: "", legs: [], labels: [] };

/** One Trip's page, from the Trip Lines page's Trips tab: its name, days and legs, and its days' lines. */
export function TripPage({ id }: { id: string }) {
  const combined = useSessionData();
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
  const combined = useSessionData();
  if (combined.isPending) return <p>Reading the photos and Trips…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <TripDetail id={id} data={combined.data} />;
}

/** The Trip the URL names, or a new one: its map, then its editor. */
function TripDetail({ id, data }: { id: string; data: CombinedData }) {
  const navigate = useNavigate();
  const all = trips(data);
  const trip = id === NEW_TRIP_ID ? NEW_TRIP : all.find((t) => t.id === id);
  if (!trip)
    return <p className="text-muted-foreground text-sm">There's no Trip with the ID “{id}”.</p>;
  const photos = shownPhotos(data);
  const days = lineDays(data);
  return (
    <TripEditor
      key={trip.id || NEW_TRIP_ID}
      trip={trip}
      others={all.filter((t) => t.id !== trip.id)}
      days={new Map(days.map((d) => [d.day, d]))}
      lines={tripLines(data)}
      countPhotos={(start, end) => photosBetween(photos, start, end)}
      legacy={legacyTripIds(data).has(trip.id)}
      onSaved={(saved) =>
        void navigate({ to: "/trip-lines/trips/$id", params: { id: saved }, replace: true })
      }
      onRemoved={() => void navigate({ to: "/trip-lines", search: { tab: "trips" } })}
    />
  );
}
