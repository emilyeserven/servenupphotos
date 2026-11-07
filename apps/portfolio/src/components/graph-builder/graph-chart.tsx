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
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { WithKey } from "@/components/graph-builder/graph-key";
import { GraphTooltip, shortLabel } from "@/components/graph-builder/graph-parts";
import { pickedOpacity, pickOf, useGraphPick } from "@/components/graph-builder/graph-pick-context";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatValue, type GraphData, type Measure, seriesColor } from "@/lib/graph-data";

/** How tall the bar, line and pie graphs are: squarer on a phone. */
const CHART_CLASS = "aspect-[4/3] w-full sm:aspect-[2/1]";

/** A datum as recharts reads it: its label and photos, and each series' number at the top level. */
type FlatDatum = { label: string; photos: number } & Record<string, number | string>;

/** The data with each series' number moved up beside the label, for recharts. */
function flat(data: GraphData["data"]): FlatDatum[] {
  return data.map((datum) => ({ label: datum.label, photos: datum.photos, ...datum.values }));
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

/** A bar or line graph's frame: the graph, with its key on the right when it's split. */
function Frame({ graph, children }: { graph: GraphData; children: ReactElement }) {
  const split = graph.series[0]?.key !== "value";
  return (
    <WithKey items={split ? graph.series : []}>
      <ChartContainer config={{}} className={CHART_CLASS}>
        {children}
      </ChartContainer>
    </WithKey>
  );
}

/** Picking the clicked value of a bar or line graph, so its photos show under it. */
function useClickPick(graph: GraphData) {
  const { onPick } = useGraphPick();
  return (state: { activeIndex?: unknown }) => {
    const pick = pickOf(graph.data[Number(state.activeIndex)]);
    if (pick) onPick(pick);
  };
}

/** What every bar and line graph has: a grid, both axes and the tooltip. */
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
  const { pick } = useGraphPick();
  return (
    <Frame graph={graph}>
      <BarChart
        data={flat(graph.data)}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        onClick={useClickPick(graph)}
        className="cursor-pointer"
      >
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
          >
            {graph.data.map((datum) => (
              <Cell key={datum.label} fillOpacity={pickedOpacity(pick, datum.label)} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </Frame>
  );
}

/** A line graph, one line for each series, with a dot at each value. */
export function LineGraph({ graph, measure }: CartesianProps) {
  const { pick } = useGraphPick();
  return (
    <Frame graph={graph}>
      <LineChart
        data={flat(graph.data)}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        onClick={useClickPick(graph)}
        className="cursor-pointer"
      >
        {cartesianParts({ graph, measure })}
        {pick && <ReferenceLine x={pick.x} stroke="var(--foreground)" strokeDasharray="4 4" />}
        {graph.series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            type="linear"
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 4, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
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
  const { pick, onPick } = useGraphPick();
  const pickSlice = (_: unknown, index: number) => {
    const picked = pickOf(graph.data[index]);
    if (picked) onPick(picked);
  };
  return (
    <WithKey items={slices.map((s, index) => ({ label: s.label, color: seriesColor(index) }))}>
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
            onClick={pickSlice}
            className="cursor-pointer"
          >
            {slices.map((slice, index) => (
              <Cell
                key={slice.label}
                fill={seriesColor(index)}
                fillOpacity={pickedOpacity(pick, slice.label)}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </WithKey>
  );
}
