import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseCameraFilters } from "@/lib/camera-filters";
import { parseFilters } from "@/lib/photo-filters";
import { parseShownPhoto } from "@/lib/shown-photo";
import { parseTableSearch } from "@/lib/table-search";

// The Table is a view on the Grid page now; older links go there, keeping their sort, columns,
// filters and open photo.
export const Route = createFileRoute("/table")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/grid", search: gridSearchOf(search) });
  },
});

/** An older Table link's search as the Grid's, its `?sort=` column becoming `?column=`. */
function gridSearchOf(search: Record<string, unknown>) {
  return {
    view: "table" as const,
    ...parseTableSearch(search, "sort"),
    ...parseFilters(search),
    ...parseCameraFilters(search),
    ...parseShownPhoto(search),
  };
}
