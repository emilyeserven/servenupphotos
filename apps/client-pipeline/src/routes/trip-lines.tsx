import { createFileRoute } from "@tanstack/react-router";
import { TripLinesPage } from "@/components/trip-lines/page";
import { parseTripLinesSearch } from "@/lib/trip-lines-search";

export const Route = createFileRoute("/trip-lines")({
  validateSearch: parseTripLinesSearch,
  component: TripLinesPage,
});
