import { createFileRoute, redirect } from "@tanstack/react-router";
import { TripDayCrumbs } from "@/components/sidebar/route-crumbs";
import { TripDayPage } from "@/components/trip-lines/day-page";
import { isDayPart, parseTripDaySearch } from "@/lib/trip-lines-search";

export const Route = createFileRoute("/trip-lines/$day/$part")({
  validateSearch: parseTripDaySearch,
  // A page the day doesn't have opens its first, the photo order.
  beforeLoad: ({ params }) => {
    if (isDayPart(params.part)) return;
    throw redirect({
      to: "/trip-lines/$day/$part",
      params: { day: params.day, part: "order" },
      replace: true,
    });
  },
  component: TripDayPage,
  staticData: { crumbs: TripDayCrumbs },
});
