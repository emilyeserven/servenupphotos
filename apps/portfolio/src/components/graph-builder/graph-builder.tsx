import { ChartColumn, Table2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { BarGraph, LineGraph, PieGraph } from "@/components/graph-builder/graph-chart";
import { type ConfigChange, GraphControls } from "@/components/graph-builder/graph-controls";
import { GraphFilters } from "@/components/graph-builder/graph-filters";
import { GraphPresets } from "@/components/graph-builder/graph-presets";
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
 * A graph of the person's own making from the Numbers page's counts: they pick its type (bar, line,
 * pie or scatterplot), the stat along each axis, what splits a bar or line graph, and filters on
 * the photos it counts. Its numbers show as a table too.
 */
export function GraphBuilder() {
  const [config, setConfig] = useState(START);
  const [view, setView] = useState<View>("graph");
  const onChange: ConfigChange = (change) => setConfig((current) => ({ ...current, ...change }));
  const kept = useMemo(() => filteredPhotos(photos, config.filters), [config.filters]);
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <GraphPresets onPick={onChange} />
      <GraphControls config={config} onChange={onChange} />
      <GraphFilters
        filters={config.filters}
        kept={kept.length}
        onChange={(filters) => onChange({ filters })}
      />
      <div className="flex justify-end">
        <ViewButtons view={view} onChange={setView} />
      </div>
      {kept.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No photos are left by these filters.
        </p>
      ) : (
        <GraphBody list={kept} config={config} view={view} />
      )}
    </section>
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
