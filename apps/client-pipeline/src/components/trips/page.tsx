import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { TripsPanel } from "@/components/trips/trips-panel";
import { lineDays } from "@/lib/stale-trip-lines";
import { useCombinedData } from "@/stores/combined-data";

/**
 * The Trips page: names for runs of days, such as "Japan", shown on the portfolio's Timeline, with
 * the legs travelled between them drawn on the map, and a Trip page for their days' stories.
 */
export function TripsPage() {
  return (
    <Page
      wide
      title="Trips"
      description="Names for runs of days, such as “Korea” for Sep 20 to 21 and “Japan” for Sep 22 to Oct 2. The portfolio's Timeline shows each day's Trip beside the date in its heading, the map draws the legs travelled between days, such as a ferry or a flight, and the days' stories make up the Trip's page. Each Trip is one JSON file, combined into TIMELINE.json."
    >
      <GitHubGate>{() => <Trips />}</GitHubGate>
    </Page>
  );
}

function Trips() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and Trips…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <TripsPanel data={combined.data} days={lineDays(combined.data)} />;
}
