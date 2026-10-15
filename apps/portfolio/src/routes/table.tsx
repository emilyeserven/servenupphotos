import { createFileRoute } from "@tanstack/react-router";
import { ViewPlaceholder } from "@/components/view-placeholder";

export const Route = createFileRoute("/table")({
  component: TableView,
});

function TableView() {
  return <ViewPlaceholder to="/table" />;
}
