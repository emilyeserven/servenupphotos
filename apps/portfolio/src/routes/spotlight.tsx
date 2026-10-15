import { createFileRoute } from "@tanstack/react-router";
import { ViewPlaceholder } from "@/components/view-placeholder";

export const Route = createFileRoute("/spotlight")({
  component: SpotlightView,
});

function SpotlightView() {
  return <ViewPlaceholder to="/spotlight" />;
}
