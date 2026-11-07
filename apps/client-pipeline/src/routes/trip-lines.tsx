import { createFileRoute } from "@tanstack/react-router";
import { TripLinesPage } from "@/components/trip-lines/page";

/** The Trip Lines page's search: the day to open on, such as a link from Needs attention gives. */
interface TripLinesSearch {
  day?: string;
}

function parseTripLinesSearch(search: Record<string, unknown>): TripLinesSearch {
  const { day } = search;
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? { day } : {};
}

export const Route = createFileRoute("/trip-lines")({
  validateSearch: parseTripLinesSearch,
  component: TripLinesPage,
});
