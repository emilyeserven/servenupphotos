import { createFileRoute } from "@tanstack/react-router";
import { ChartColumn } from "lucide-react";
import { COLUMN, GraphBuilder } from "@/components/graph-builder/graph-builder";
import { type CameraFilters, filterWithCamera, parseCameraFilters } from "@/lib/camera-filters";
import { parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import { photos } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch } from "@/lib/shown-photo";
import { SiteHomeLink } from "@/components/site-home-link";
import { useGraphWide } from "@/lib/graph-wide";

/** What the Graph page keeps in the URL: the site's usual filters and the selected photo open in the lightbox. */
type GraphSearch = PhotoFilters & CameraFilters & ShownPhotoSearch;

export const Route = createFileRoute("/graph")({
  validateSearch: (search: Record<string, unknown>): GraphSearch => ({
    ...parseFilters(search),
    ...parseCameraFilters(search),
    ...parseShownPhoto(search),
  }),
  component: GraphView,
});

/** The Graph page: a graph of your own making from the counts on the Numbers page. */
function GraphView() {
  const [wide, setWide] = useGraphWide();
  const search = Route.useSearch();
  const kept = filterWithCamera(photos, search);
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-16 sm:px-6 lg:px-10">
      <header className={COLUMN}>
        <SiteHomeLink className="mb-1" />
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <ChartColumn className="size-8 text-muted-foreground" aria-hidden />
          Graph
        </h1>
        <p className="mt-2 text-muted-foreground">
          Make a graph of your own from the counts on the Numbers page: pick its type, what goes on
          each axis, what splits the bars or lines, and which photos it counts.
        </p>
      </header>
      <GraphBuilder photos={photos} kept={kept} wide={wide} onWideChange={setWide} />
    </div>
  );
}
