import { createFileRoute, redirect } from "@tanstack/react-router";
import { TripLinesPage } from "@/components/trip-lines/page";
import { parseTripLinesSearch } from "@/lib/trip-lines-search";

export const Route = createFileRoute("/trip-lines/")({
  validateSearch: parseTripLinesSearch,
  // A link from before each day had pages of its own opens that day's Route page.
  // A link to a Trip on the Trips tab, from before each Trip had a page, opens its page.
  beforeLoad: ({ search }) => {
    if (search.tab === "trips" && search.trip) {
      throw redirect({ to: "/trip-lines/trips/$id", params: { id: search.trip }, replace: true });
    }
    if (!search.day) return;
    throw redirect({
      to: "/trip-lines/$day/$part",
      params: { day: search.day, part: "route" },
      search: { group: search.group },
      replace: true,
    });
  },
  component: TripLinesPage,
});
