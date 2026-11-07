import type { CombinedData } from "@/api/photos";
import { tripLines } from "@/api/trip-lines";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { DayGrid } from "@/components/trip-lines/day-grid";
import { TripsPanel } from "@/components/trips/trips-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lineDays, staleTripLines } from "@/lib/stale-trip-lines";
import { useTripLinesSearch } from "@/lib/trip-lines-search";
import { useCombinedData } from "@/stores/combined-data";

/** The Trip Lines page: each day's route, drawn on the portfolio's map. */
export function TripLinesPage() {
  return (
    <Page
      wide
      title="Trip Lines"
      description="The route of a day, drawn on the portfolio's map: walking from photo to photo in the order they were taken, and hops by train, subway, bus or car between. Trips add the ferries and flights between days. Each day's line is one JSON file, combined into TRIPLINES.json, and Commit bakes them with their photos' spots into TRIPLINES.geo.json for the map."
    >
      <GitHubGate>{() => <Days />}</GitHubGate>
    </Page>
  );
}

/** The page once the photos and lines are read. */
function Days() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and trip lines…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <DaysAndTrips data={combined.data} />;
}

/** The days' lines, and the Trips that add the legs between days, each on a tab. */
function DaysAndTrips({ data }: { data: CombinedData }) {
  const { search, set } = useTripLinesSearch();
  return (
    <Tabs
      value={search.tab ?? "days"}
      onValueChange={(tab) => set({ tab: tab === "trips" ? "trips" : undefined })}
    >
      <TabsList>
        <TabsTrigger value="days">Days</TabsTrigger>
        <TabsTrigger value="trips">Trips</TabsTrigger>
      </TabsList>
      <TabsContent value="days">
        <DayCards data={data} />
      </TabsContent>
      <TabsContent value="trips">
        <TripsPanel data={data} days={lineDays(data)} />
      </TabsContent>
    </Tabs>
  );
}

/** Every day a line can be marked for, each linking to its pages. */
function DayCards({ data }: { data: CombinedData }) {
  const days = lineDays(data);
  if (days.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No day has two or more photos at two or more exact spots yet.
      </p>
    );
  }
  const stale = new Set(staleTripLines(data).map((s) => s.day));
  return <DayGrid days={days} lines={tripLines(data)} stale={stale} />;
}
