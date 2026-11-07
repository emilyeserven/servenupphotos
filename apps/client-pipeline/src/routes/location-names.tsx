import { createFileRoute } from "@tanstack/react-router";
import { LocationNamesCard } from "@/components/location-names-card";
import { CardPage } from "@/components/update-data/card-page";

export const Route = createFileRoute("/location-names")({
  component: LocationNamesPage,
});

/** The Location Names page, under Places in the sidebar. */
function LocationNamesPage() {
  return (
    <CardPage
      title="Location Names"
      description="Writes each country, state and city by the name that wins over its other names, in every photo and place file."
    >
      <LocationNamesCard />
    </CardPage>
  );
}
