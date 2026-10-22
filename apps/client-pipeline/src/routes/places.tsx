import { createFileRoute } from "@tanstack/react-router";
import { PlacesPage } from "@/components/places-page";

export const Route = createFileRoute("/places")({
  component: PlacesPage,
});
