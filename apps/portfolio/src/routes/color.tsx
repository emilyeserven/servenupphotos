import { createFileRoute } from "@tanstack/react-router";
import { ViewPlaceholder } from "@/components/view-placeholder";

export const Route = createFileRoute("/color")({
  component: ColorView,
});

function ColorView() {
  return <ViewPlaceholder to="/color" />;
}
