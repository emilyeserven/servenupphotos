import { createFileRoute } from "@tanstack/react-router";
import { PlacesPage } from "@/components/places-page";

/** The Places page's search: `edit`, the row Quick Edit opens, such as `city/seoul` or `place/<id>`. */
interface PlacesSearch {
  edit?: string;
}

export const Route = createFileRoute("/places")({
  validateSearch: (search: Record<string, unknown>): PlacesSearch =>
    typeof search.edit === "string" && search.edit !== "" ? { edit: search.edit } : {},
  component: PlacesPage,
});
