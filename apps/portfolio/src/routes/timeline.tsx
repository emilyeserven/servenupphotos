import { createFileRoute } from "@tanstack/react-router";
import { ViewPlaceholder } from "@/components/view-placeholder";

export const Route = createFileRoute("/timeline")({
  component: TimelineView,
});

function TimelineView() {
  return <ViewPlaceholder to="/timeline" />;
}
