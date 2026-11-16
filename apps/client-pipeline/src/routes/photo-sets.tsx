import { createFileRoute } from "@tanstack/react-router";
import { type GridFilters, parseGridFilters } from "@/components/gallery/grid-filters";
import { PhotoSetsPage } from "@/components/photo-sets/page";

/** The Photo Sets page's search: the set open, and the drawer's portfolio Grid filters. */
type PhotoSetsSearch = GridFilters & {
  /** The ID of the set open; the first one when left out. */
  set?: string;
};

export const Route = createFileRoute("/photo-sets")({
  component: PhotoSetsPage,
  staticData: { wide: true },
  validateSearch: (search: Record<string, unknown>): PhotoSetsSearch => ({
    ...parseGridFilters(search),
    set: typeof search.set === "string" && search.set ? search.set : undefined,
  }),
});
