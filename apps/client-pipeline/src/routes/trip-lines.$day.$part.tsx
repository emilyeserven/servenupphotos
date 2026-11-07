import { createFileRoute, redirect } from "@tanstack/react-router";
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
    if (isDayPart(params.part)) return;
    throw redirect({
      to: "/trip-lines/$day/$part",
      params: { day: params.day, part: fallbackPart(params.part) },
      replace: true,
    });
  },
  component: TripDayPage,
});
