import { useSearch } from "@tanstack/react-router";
import { useState } from "react";
import type { CombinedData } from "@/api/photos";
import { type TripLine, tripLines } from "@/api/trip-lines";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { DayEditor } from "@/components/trip-lines/day-editor";
import { DayList } from "@/components/trip-lines/day-list";
import { TripsPanel } from "@/components/trips/trips-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lineDays, staleTripLines } from "@/lib/stale-trip-lines";
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

function Days() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and trip lines…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <DaysAndTrips data={combined.data} />;
}

/** The days' lines, and the Trips that add the legs between days, each on a tab. */
function DaysAndTrips({ data }: { data: CombinedData }) {
  return (
    <Tabs defaultValue="days">
      <TabsList>
        <TabsTrigger value="days">Days</TabsTrigger>
        <TabsTrigger value="trips">Trips</TabsTrigger>
      </TabsList>
      <TabsContent value="days">
        <DayChooser data={data} />
      </TabsContent>
      <TabsContent value="trips">
        <TripsPanel data={data} days={lineDays(data)} />
      </TabsContent>
    </Tabs>
  );
}

/** The days listed on the left, newest first, and the chosen one edited on the right. */
function DayChooser({ data }: { data: CombinedData }) {
  const days = lineDays(data);
  const lines: Map<string, TripLine> = tripLines(data);
  const linked = useSearch({ from: "/trip-lines" }).day;
  const [chosen, setChosen] = useState(() => linked ?? days[0]?.day);
  const stale = new Set(staleTripLines(data).map((s) => s.day));
  const day = days.find((d) => d.day === chosen) ?? days[0];
  if (!day) {
    return (
      <p className="text-muted-foreground text-sm">
        No day has two or more photos at two or more exact spots yet.
      </p>
    );
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <DayList days={days} lines={lines} stale={stale} chosen={day.day} onChoose={setChosen} />
      <DayEditor key={day.day} day={day} line={lines.get(day.day)} />
    </div>
  );
}
