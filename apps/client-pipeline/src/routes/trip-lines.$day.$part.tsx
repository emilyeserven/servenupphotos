import { createFileRoute, redirect } from "@tanstack/react-router";
import { TripDayCrumbs } from "@/components/sidebar/route-crumbs";
import { TripDayPage } from "@/components/trip-lines/day-page";
import { isDayPart, parseTripDaySearch } from "@/lib/trip-lines-search";

/** Where a page the day doesn't have goes: the old Places page to Trip Stops, the rest to the photo order. */
function fallbackPart(part: string) {
  return part === "places" ? "stops" : "order";
}

export const Route = createFileRoute("/trip-lines/$day/$part")({
  validateSearch: parseTripDaySearch,
  // A page the day doesn't have opens its first, the photo order (or Trip Stops for an old Places link).
  beforeLoad: ({ params }) => {
    // Something other than a day, such as a typo, goes back to the list of days.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.day))
      throw redirect({ to: "/trip-lines", replace: true });
    if (isDayPart(params.part)) return;
    throw redirect({
      to: "/trip-lines/$day/$part",
      params: { day: params.day, part: fallbackPart(params.part) },
      replace: true,
    });
  },
  component: TripDayPage,
  staticData: { crumbs: TripDayCrumbs },
});
