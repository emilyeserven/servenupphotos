import { createFileRoute } from "@tanstack/react-router";
import { TripLinesPage } from "@/components/trip-lines/page";

export const Route = createFileRoute("/trip-lines")({
  component: TripLinesPage,
});
