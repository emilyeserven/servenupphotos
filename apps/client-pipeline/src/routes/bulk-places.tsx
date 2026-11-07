import { createFileRoute } from "@tanstack/react-router";
import { BulkPlacesCard } from "@/components/bulk-places/bulk-places-card";
import { CardPage } from "@/components/update-data/card-page";

export const Route = createFileRoute("/bulk-places")({
  component: BulkPlacesPage,
});

/** The Bulk Places page, under Places in the sidebar. */
function BulkPlacesPage() {
  return (
    <CardPage
      title="Bulk Places"
      description="Asks an LLM where photos without places were taken, then reviews each place before it's saved."
    >
      <BulkPlacesCard />
    </CardPage>
  );
}
