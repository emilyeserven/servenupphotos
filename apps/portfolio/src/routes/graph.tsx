import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChartColumn } from "lucide-react";
import { COLUMN, GraphBuilder } from "@/components/graph-builder/graph-builder";
import { type CameraFilters, filterWithCamera, parseCameraFilters } from "@/lib/camera-filters";
import { type ColorFilters, filterByColors, parseColorFilters } from "@/lib/color-search";
import { parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import { photos } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch } from "@/lib/shown-photo";
import { SiteHomeLink } from "@/components/site-home-link";
import { useGraphWide } from "@/lib/graph-wide";
import {
  GRAPH_PARAMS,
  type GraphSearch,
  graphFromSearch,
  graphToSearch,
  parseGraphSearch,
} from "@/lib/graph-search";
import type { GraphConfig } from "@/lib/graph-data";

/**
 * What the Graph page keeps in the URL: the site's usual filters, Visuals' colors, the selected
 * photo open in the lightbox, and the graph's settings, so a link shares the graph (see `GraphSearch`).
 */
type GraphPageSearch = PhotoFilters & CameraFilters & ColorFilters & ShownPhotoSearch & GraphSearch;

export const Route = createFileRoute("/graph")({
  validateSearch: (search: Record<string, unknown>): GraphPageSearch => ({
    ...parseFilters(search),
    ...parseCameraFilters(search),
    ...parseColorFilters(search),
    ...parseShownPhoto(search),
    ...parseGraphSearch(search),
  }),
  component: GraphView,
});

/** The Graph page: a graph of your own making from the counts on the Numbers page. */
function GraphView() {
  const [wide, setWide] = useGraphWide();
  const search = Route.useSearch();
  const kept = filterByColors(filterWithCamera(photos, search), search);
  const config = useMemo(() => graphFromSearch(search), [search]);
  const navigate = Route.useNavigate();
  const onConfigChange = (next: GraphConfig) =>
    void navigate({
      search: (current) => ({ ...withoutGraph(current), ...graphToSearch(next) }),
      replace: true,
    });
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
      <GraphBuilder
        photos={photos}
        kept={kept}
        config={config}
        onConfigChange={onConfigChange}
        wide={wide}
        onWideChange={setWide}
      />
    </div>
  );
}

/** The URL's search without the graph's params, which a new graph replaces. */
function withoutGraph(search: GraphPageSearch): GraphPageSearch {
  return Object.fromEntries(
    Object.entries(search).filter(([key]) => !(GRAPH_PARAMS as string[]).includes(key)),
  ) as GraphPageSearch;
}
