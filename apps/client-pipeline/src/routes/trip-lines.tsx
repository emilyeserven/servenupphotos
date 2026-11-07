import { createFileRoute, redirect } from "@tanstack/react-router";
import { TripLinesPage } from "@/components/trip-lines/page";
import { parseTripLinesSearch } from "@/lib/trip-lines-search";

export const Route = createFileRoute("/trip-lines")({
  validateSearch: parseTripLinesSearch,
  // A link to a Trip on the Trips tab, from before each Trip had a page, opens its page.
  beforeLoad: ({ search }) => {
    if (search.tab !== "trips" || !search.trip) return;
    throw redirect({ to: "/trip-lines/trips/$id", params: { id: search.trip }, replace: true });
  },
  component: TripLinesPage,
});
