import { Fragment, type ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { GraphLegend, GraphTooltip, shortLabel } from "@/components/graph-builder/graph-parts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatValue, type GraphData, type Measure, seriesColor } from "@/lib/graph-data";

/** How tall the bar, line and pie graphs are: squarer on a phone. */
const CHART_CLASS = "aspect-[4/3] w-full sm:aspect-[2/1]";

/** A datum as recharts reads it: its label and photos, and each series' number at the top level. */
type FlatDatum = { label: string; photos: number } & Record<string, number | string>;

/** The data with each series' number moved up beside the label, for recharts. */
function flat(data: GraphData["data"]): FlatDatum[] {
  return data.map(({ values, ...rest }) => ({ ...rest, ...values }));
}

/** What a bar or line graph needs to draw. */
interface CartesianProps {
  graph: GraphData;
  measure: Measure;
}

/** The x axis of a bar or line graph: every value named, slanted when there are many. */
function categoryAxis(count: number) {
  const slanted = count > 6;
  return (
    <XAxis
      dataKey="label"
      tickLine={false}
      axisLine={false}
      interval={0}
      tickFormatter={shortLabel}
      angle={slanted ? -40 : 0}
      textAnchor={slanted ? "end" : "middle"}
      height={slanted ? 84 : 30}
      padding={{ left: 24, right: 24 }}
    />
  );
}

/** The y axis of a bar or line graph, as counts or shares, from and to where the Range group sets. */
function valueAxis(measure: Measure, domain: GraphData["domain"]) {
  return (
    <YAxis
      domain={domain}
      allowDataOverflow={domain !== undefined}
      tickLine={false}
      axisLine={false}
      width={44}
      allowDecimals={false}
      tickFormatter={(value: number) => formatValue(value, measure)}
    />
  );
}

/** A bar, line or dot graph's frame: a key over it when it's split, then the graph. */
function Frame({ graph, children }: { graph: GraphData; children: ReactElement }) {
  return (
    <>
      {graph.series[0]?.key !== "value" && <GraphLegend items={graph.series} />}
      <ChartContainer config={{}} className={CHART_CLASS}>
        {children}
      </ChartContainer>
    </>
  );
}

/** What every bar, line and dot graph has: a grid, both axes and the tooltip. */
function cartesianParts({ graph, measure }: CartesianProps) {
  return [
    <CartesianGrid key="grid" vertical={false} />,
    <Fragment key="x">{categoryAxis(graph.data.length)}</Fragment>,
    <Fragment key="y">{valueAxis(measure, graph.domain)}</Fragment>,
    <ChartTooltip
      key="tooltip"
      content={<GraphTooltip series={graph.series} measure={measure} />}
    />,
  ];
}

/** A bar graph; a split one's parts stacked or side by side, with a gap between them. */
export function BarGraph({ graph, measure, stacked }: CartesianProps & { stacked: boolean }) {
  const stack = stacked ? "parts" : undefined;
  return (
    <Frame graph={graph}>
      <BarChart data={flat(graph.data)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {cartesianParts({ graph, measure })}
        {graph.series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={stack}
            radius={stack ? 0 : [4, 4, 0, 0]}
            stroke="var(--card)"
            strokeWidth={stack ? 2 : 0}
            maxBarSize={56}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </Frame>
  );
}

/**
 * A line graph, one line for each series; or with `dots`, a dot graph: only each value's dot, at
 * how many photos it has, such as one for each aperture.
 */
export function LineGraph({ graph, measure, dots = false }: CartesianProps & { dots?: boolean }) {
  return (
    <Frame graph={graph}>
      <LineChart data={flat(graph.data)} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        {cartesianParts({ graph, measure })}
        {graph.series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            type="linear"
            stroke={dots ? "none" : s.color}
            strokeWidth={2}
            dot={{ r: dots ? 5 : 4, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </Frame>
  );
}

/** A pie, each x value a slice in its own color, with a gap between them. */
export function PieGraph({ graph, measure }: CartesianProps) {
  const slices = flat(graph.data);
  return (
    <>
      <GraphLegend
        items={slices.map((s, index) => ({ label: s.label, color: seriesColor(index) }))}
      />
      <ChartContainer config={{}} className={CHART_CLASS}>
        <PieChart>
          <ChartTooltip content={<GraphTooltip series={graph.series} measure={measure} />} />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius="45%"
            outerRadius="85%"
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {slices.map((slice, index) => (
              <Cell key={slice.label} fill={seriesColor(index)} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </>
  );
}
