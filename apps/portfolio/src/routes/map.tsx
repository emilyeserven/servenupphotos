import { createFileRoute } from "@tanstack/react-router";
import { ViewPlaceholder } from "@/components/view-placeholder";

export const Route = createFileRoute("/map")({
  component: MapView,
});

function MapView() {
  return <ViewPlaceholder to="/map" />;
}
