import { ChartColumn, Maximize2, Minimize2, Table2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AxisLabels } from "@/components/graph-builder/graph-axes";
import { BarGraph, LineGraph, PieGraph } from "@/components/graph-builder/graph-chart";
import { type ConfigChange } from "@/components/graph-builder/graph-controls";
import {
  DEFAULT_GRAPH_DISPLAY,
  type GraphDisplay,
  GraphDisplayContext,
  GraphDisplayOptions,
} from "@/components/graph-builder/graph-display";
import { GraphTabs } from "@/components/graph-builder/graph-tabs";
import { GraphPickContext } from "@/components/graph-builder/graph-pick-context";
import { SpotlightPresets } from "@/components/graph-builder/graph-presets";
import { HeatmapGraph } from "@/components/graph-builder/heatmap-graph";
import { PhotoDotsGraph } from "@/components/graph-builder/photo-dots-graph";
import { PickedPhotos } from "@/components/graph-builder/picked-photos";
import { ScatterGraph } from "@/components/graph-builder/scatter-graph";
import { GraphTable, ScatterTable } from "@/components/graph-builder/graph-table";
import {
  type GraphConfig,
  type GraphData,
  graphData,
  type GraphType,
  hasYStat,
  scatterData,
  statById,
} from "@/lib/graph-data";
import { Button } from "@/components/ui/button";
import { type GraphPick, samePick } from "@/lib/graph-pick";
import { photoDots } from "@/lib/graph-photo-dots";
import type { Photo } from "@/lib/photos";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";
import { cn } from "@/lib/utils";

/** Whether the graph or its numbers as a table show. */
type View = "graph" | "table";

/**
 * A graph of the person's own making from the Numbers page's counts. The pipeline's spotlight
 * presets come first, then the tabs (see `GraphTabs`): Presets, Adjust Graph (the graph's type, the
 * stat along each axis, what splits a bar or line graph), Filters (the site's usual filters,
 * kept in the URL, which pick the photos it counts) and Save as preset, each opening a box. Under them, the graph's box names each axis with a dropdown to change it,
 * and shows its numbers as a table too. Clicking a bar, point, slice or dot shows its photos under
 * the graph; changing the graph clears it.
 */
export function GraphBuilder({
  photos,
  kept,
  config,
  onConfigChange,
  wide,
  onWideChange,
}: {
  /** Every photo, which the filters are read from. */
  photos: Photo[];
  /** The photos the filters and the text search leave, which the graph counts. */
  kept: Photo[];
  /** The graph's settings, which the page keeps in the URL so a link shares the graph. */
  config: GraphConfig;
  onConfigChange: (config: GraphConfig) => void;
  /** Whether the graph uses the window's whole width, while everything else keeps to the column. */
  wide: boolean;
  onWideChange: (wide: boolean) => void;
}) {
  const [view, setView] = useState<View>("graph");
  const [pick, setPick] = useState<GraphPick | null>(null);
  const [display, setDisplay] = useState(DEFAULT_GRAPH_DISPLAY);
  const onChange: ConfigChange = (change) => {
    onConfigChange({ ...config, ...change });
    setPick(null);
  };
  const onPick = (next: GraphPick) => setPick(samePick(pick, next) ? null : next);
  return (
    <div className="flex flex-col gap-4">
      <div className={cn(COLUMN, "flex flex-col gap-4")}>
        <SpotlightPresets onPick={onChange} />
        <GraphTabs config={config} onChange={onChange} photos={photos} list={kept} />
      </div>
      <section className={cn(BOX_CLASS, !wide && COLUMN)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">
            {kept.length.toLocaleString()} of {photos.length.toLocaleString()} photos
          </span>
          <div className="flex items-center gap-2">
            <DisplayButton config={config} view={view} display={display} onChange={setDisplay} />
            <WideButton wide={wide} onChange={onWideChange} />
            <ViewButtons view={view} onChange={setView} />
          </div>
        </div>
        <GraphDisplayContext value={display}>
          <GraphPickContext value={{ pick, onPick }}>
            <GraphArea list={kept} config={config} view={view} onChange={onChange} />
          </GraphPickContext>
        </GraphDisplayContext>
      </section>
      {pick && (
        <div className={COLUMN}>
          <PickedPhotos
            key={JSON.stringify(pick)}
            list={kept}
            config={config}
            pick={pick}
            onClear={() => setPick(null)}
          />
        </div>
      )}
    </div>
  );
}

/** The page's usual column, which everything but a wide graph keeps to. */
export const COLUMN = "mx-auto w-full max-w-5xl";

/** How the Graph page's boxes look. */
const BOX_CLASS =
  "flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm";

/**
 * The graph, its axes named with dropdowns to change them, or its table; a note instead when the
 * filters leave no photos.
 */
function GraphArea({
  list,
  config,
  view,
  onChange,
}: {
  list: Photo[];
  config: GraphConfig;
  view: View;
  onChange: ConfigChange;
}) {
  if (list.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No photos are left by these filters.
      </p>
    );
  }
  const body = <GraphBody list={list} config={config} view={view} />;
  if (view === "table") return body;
  return (
    <AxisLabels config={config} onChange={onChange}>
      {body}
    </AxisLabels>
  );
}

/** The display options' eye button, for a pie's graph: the only graph with any yet. */
function DisplayButton({
  config,
  view,
  ...props
}: {
  config: GraphConfig;
  view: View;
  display: GraphDisplay;
  onChange: (display: GraphDisplay) => void;
}) {
  if (config.type !== "pie" || view !== "graph") return null;
  return <GraphDisplayOptions {...props} />;
}

/** The button that makes the graph use the window's whole width, or the usual column again. */
function WideButton({ wide, onChange }: { wide: boolean; onChange: (wide: boolean) => void }) {
  const Icon = wide ? Minimize2 : Maximize2;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={wide}
      onClick={() => onChange(!wide)}
    >
      <Icon aria-hidden />
      {wide ? "Narrow" : "Wide"}
    </Button>
  );
}

/** The buttons switching between the graph and its table. */
function ViewButtons({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const button = (option: View, label: string, Icon: typeof Table2) => (
    <button
      type="button"
      aria-pressed={view === option}
      onClick={() => onChange(option)}
      className={controlButtonClass(view === option)}
    >
      <Icon aria-hidden />
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Show as" className={CONTROL_FRAME}>
      {button("graph", "Graph", ChartColumn)}
      {button("table", "Table", Table2)}
    </div>
  );
}

/** What the builder draws: a photo dot graph, a scatterplot or heatmap, or a bar, line or pie graph, as a graph or a table. */
function GraphBody({ list, config, view }: { list: Photo[]; config: GraphConfig; view: View }) {
  if (config.type === "photos") return <PhotoDotsBody list={list} config={config} view={view} />;
  if (hasYStat(config.type)) return <ScatterBody list={list} config={config} view={view} />;
  return <SeriesBody list={list} config={config} view={view} />;
}

/** A scatterplot or heatmap of the photos kept, or its dots or cells as a table. */
function ScatterBody({ list, config, view }: { list: Photo[]; config: GraphConfig; view: View }) {
  const data = useMemo(() => scatterData(list, config), [list, config]);
  const names = { xName: statById(config.x).label, yName: statById(config.y).label };
  if (view === "table") return <ScatterTable data={data} {...names} />;
  if (config.type === "heatmap") return <HeatmapGraph data={data} {...names} />;
  return <ScatterGraph data={data} {...names} />;
}

/** A photo dot graph of the photos kept, or its photo counts as a table. */
function PhotoDotsBody({ list, config, view }: { list: Photo[]; config: GraphConfig; view: View }) {
  const counted = { ...config, measure: "count" as const };
  if (view === "table") return <SeriesBody list={list} config={counted} view={view} />;
  return <PhotoDotsChart list={list} config={config} />;
}

/** The photo dot graph itself. */
function PhotoDotsChart({ list, config }: { list: Photo[]; config: GraphConfig }) {
  const data = useMemo(() => photoDots(list, config), [list, config]);
  return <PhotoDotsGraph data={data} xName={statById(config.x).label} />;
}

/** A bar, line or pie graph of the photos kept, or its numbers as a table. */
function SeriesBody({ list, config, view }: { list: Photo[]; config: GraphConfig; view: View }) {
  const graph = useMemo(() => graphData(list, config), [list, config]);
  if (view === "table") {
    return <GraphTable graph={graph} measure={config.measure} xName={statById(config.x).label} />;
  }
  return DRAW[config.type as SeriesType](graph, config);
}

/** The graph types drawn from series: every one but the scatterplot, the heatmap and the photo dot graph. */
type SeriesType = Exclude<GraphType, "scatter" | "heatmap" | "photos">;

/** How each of those types is drawn. */
const DRAW: Record<SeriesType, (graph: GraphData, config: GraphConfig) => ReactNode> = {
  bar: (graph, config) => (
    <BarGraph graph={graph} measure={config.measure} stacked={config.stacked} />
  ),
  line: (graph, config) => <LineGraph graph={graph} measure={config.measure} />,
  pie: (graph, config) => <PieGraph graph={graph} measure={config.measure} />,
};
