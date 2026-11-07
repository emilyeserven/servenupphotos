import { createFileRoute, redirect } from "@tanstack/react-router";
import { TripLinesPage } from "@/components/trip-lines/page";
import { parseTripLinesSearch } from "@/lib/trip-lines-search";

export const Route = createFileRoute("/trip-lines")({
  validateSearch: parseTripLinesSearch,
  // A link to the Trips tab, from before the Trips had a page of their own, opens the Trips page.
  beforeLoad: ({ search }) => {
    if (search.tab !== "trips") return;
    throw redirect({ to: "/trips", search: { trip: search.trip }, replace: true });
  },
  component: TripLinesPage,
});
