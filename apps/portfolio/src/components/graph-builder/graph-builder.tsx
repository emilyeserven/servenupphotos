import { ChartColumn, SlidersHorizontal, Table2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AxisLabels } from "@/components/graph-builder/graph-axes";
import { BarGraph, LineGraph, PieGraph } from "@/components/graph-builder/graph-chart";
import { type ConfigChange, GraphControls } from "@/components/graph-builder/graph-controls";
import { GraphFilters } from "@/components/graph-builder/graph-filters";
import { GraphPickContext } from "@/components/graph-builder/graph-pick-context";
import { GraphPresets } from "@/components/graph-builder/graph-presets";
import { PickedPhotos } from "@/components/graph-builder/picked-photos";
import { ScatterGraph } from "@/components/graph-builder/scatter-graph";
import { GraphTable, ScatterTable } from "@/components/graph-builder/graph-table";
import {
  filteredPhotos,
  type GraphConfig,
  type GraphData,
  graphData,
  type GraphType,
  scatterData,
  statById,
} from "@/lib/graph-data";
import { Button } from "@/components/ui/button";
import { type GraphPick, samePick } from "@/lib/graph-pick";
import { photos } from "@/lib/photos";
import type { Photo } from "@/lib/photos";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/** The graph shown at first: photos per year, oldest first, each bar split by season. */
const START: GraphConfig = {
  type: "bar",
  x: "year",
  measure: "count",
  y: "season",
  split: "season",
  stacked: true,
  filters: [],
  sort: "reverse",
  limit: 0,
};

/** Whether the graph or its numbers as a table show. */
type View = "graph" | "table";

/**
 * A graph of the person's own making from the Numbers page's counts. Presets come first, then the
 * Adjust Graph button, which opens a box of its settings: its type, the stat along each axis, what
 * splits a bar, line or dot graph, and filters on the photos it counts. Under them, the graph's box
 * names each axis with a dropdown to change it, and shows its numbers as a table too. Clicking a
 * bar, point, slice or dot shows its photos under the graph; changing the graph clears it.
 */
export function GraphBuilder() {
  const [config, setConfig] = useState(START);
  const [view, setView] = useState<View>("graph");
  const [adjusting, setAdjusting] = useState(false);
  const [pick, setPick] = useState<GraphPick | null>(null);
  const onChange: ConfigChange = (change) => {
    setConfig((current) => ({ ...current, ...change }));
    setPick(null);
  };
  const onPick = (next: GraphPick) => setPick(samePick(pick, next) ? null : next);
  const kept = useMemo(() => filteredPhotos(photos, config.filters), [config.filters]);
  return (
    <div className="flex flex-col gap-4">
      <GraphPresets onPick={onChange} />
      <div>
        <Button
          type="button"
          variant="outline"
          aria-expanded={adjusting}
          onClick={() => setAdjusting(!adjusting)}
        >
          <SlidersHorizontal aria-hidden />
          Adjust Graph
        </Button>
      </div>
      {adjusting && <AdjustBox config={config} onChange={onChange} />}
      <section className={BOX_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">
            {kept.length.toLocaleString()} of {photos.length.toLocaleString()} photos
          </span>
          <ViewButtons view={view} onChange={setView} />
        </div>
        <GraphPickContext value={{ pick, onPick }}>
          <GraphArea list={kept} config={config} view={view} onChange={onChange} />
        </GraphPickContext>
      </section>
      {pick && (
        <PickedPhotos
          key={JSON.stringify(pick)}
          list={kept}
          config={config}
          pick={pick}
          onClear={() => setPick(null)}
        />
      )}
    </div>
  );
}

/** How the Graph page's boxes look. */
const BOX_CLASS =
  "flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm";

/** The box Adjust Graph opens: the graph's settings, then its filters. */
function AdjustBox({ config, onChange }: { config: GraphConfig; onChange: ConfigChange }) {
  return (
    <section aria-label="Adjust Graph" className={BOX_CLASS}>
      <GraphControls config={config} onChange={onChange} />
      <GraphFilters filters={config.filters} onChange={(filters) => onChange({ filters })} />
    </section>
  );
}

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

/** What the builder draws: a scatterplot, or a bar, line or pie graph, as a graph or a table. */
function GraphBody({ list, config, view }: { list: Photo[]; config: GraphConfig; view: View }) {
  if (config.type === "scatter") return <ScatterBody list={list} config={config} view={view} />;
  return <SeriesBody list={list} config={config} view={view} />;
}

/** A scatterplot of the photos kept, or its dots as a table. */
function ScatterBody({ list, config, view }: { list: Photo[]; config: GraphConfig; view: View }) {
  const data = useMemo(() => scatterData(list, config), [list, config]);
  const names = { xName: statById(config.x).label, yName: statById(config.y).label };
  if (view === "table") return <ScatterTable data={data} {...names} />;
  return <ScatterGraph data={data} {...names} />;
}

/** A bar, line, dot or pie graph of the photos kept, or its numbers as a table. */
function SeriesBody({ list, config, view }: { list: Photo[]; config: GraphConfig; view: View }) {
  const graph = useMemo(() => graphData(list, config), [list, config]);
  if (view === "table") {
    return <GraphTable graph={graph} measure={config.measure} xName={statById(config.x).label} />;
  }
  return DRAW[config.type as SeriesType](graph, config);
}

/** The graph types drawn from series: every one but the scatterplot. */
type SeriesType = Exclude<GraphType, "scatter">;

/** How each of those types is drawn. */
const DRAW: Record<SeriesType, (graph: GraphData, config: GraphConfig) => ReactNode> = {
  bar: (graph, config) => (
    <BarGraph graph={graph} measure={config.measure} stacked={config.stacked} />
  ),
  line: (graph, config) => <LineGraph graph={graph} measure={config.measure} />,
  dot: (graph, config) => <LineGraph graph={graph} measure={config.measure} dots />,
  pie: (graph, config) => <PieGraph graph={graph} measure={config.measure} />,
};
