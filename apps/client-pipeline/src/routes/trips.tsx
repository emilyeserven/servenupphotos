import { createFileRoute } from "@tanstack/react-router";
import { TripsPage } from "@/components/trips/page";
import { parseTripsSearch } from "@/lib/trips-search";

export const Route = createFileRoute("/trips")({
  validateSearch: parseTripsSearch,
  component: TripsPage,
});
