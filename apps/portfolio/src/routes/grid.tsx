import { createFileRoute } from "@tanstack/react-router";
import { ViewPlaceholder } from "@/components/view-placeholder";

export const Route = createFileRoute("/grid")({
  component: GridView,
});

function GridView() {
  return <ViewPlaceholder to="/grid" />;
}
