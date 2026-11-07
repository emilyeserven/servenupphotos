import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import { hovered, shortLabel, TOOLTIP_CLASS } from "@/components/graph-builder/graph-parts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { ScatterData, ScatterPoint } from "@/lib/graph-data";

/** The places of an axis's values, 0 up, for its ticks. */
function places(labels: string[]): number[] {
  return labels.map((_, index) => index);
}

/** An axis's reach: half a place past its first and last values, so the dots there aren't cut off. */
function reach(labels: string[]): [number, number] {
  return [-0.5, labels.length - 0.5];
}

/** How an axis writes the value at a place, cut short. */
function label(labels: string[]) {
  return (index: number) => shortLabel(labels[index] ?? "");
}

/** How tall the scatterplot is: room for each y value, and never less than 18rem. */
function plotHeight(rows: number, xSlanted: boolean): number {
  return Math.max(288, rows * 32 + (xSlanted ? 100 : 40));
}

/**
 * A scatterplot of two stats: a dot where an x value and a y value meet, as big as how many photos
 * have both, such as Japan and Autumn. The first y value is at the top.
 */
export function ScatterGraph({
  data,
  xName,
  yName,
}: {
  data: ScatterData;
  xName: string;
  yName: string;
}) {
  const slanted = data.xLabels.length > 6;
  return (
    <ChartContainer
      config={{}}
      className="aspect-auto w-full"
      style={{ height: plotHeight(data.yLabels.length, slanted) }}
    >
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="x"
          name={xName}
          domain={reach(data.xLabels)}
          ticks={places(data.xLabels)}
          interval={0}
          tickFormatter={label(data.xLabels)}
          tickLine={false}
          angle={slanted ? -40 : 0}
          textAnchor={slanted ? "end" : "middle"}
          height={slanted ? 84 : 30}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yName}
          domain={reach(data.yLabels)}
          ticks={places(data.yLabels)}
          interval={0}
          tickFormatter={label(data.yLabels)}
          tickLine={false}
          width={104}
          reversed
        />
        <ZAxis type="number" dataKey="count" range={[40, 900]} />
        <ChartTooltip cursor={false} content={<ScatterTooltip data={data} />} />
        <Scatter
          data={data.points}
          fill="var(--series-1)"
          fillOpacity={0.85}
          stroke="var(--card)"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ChartContainer>
  );
}

/** A dot's tooltip: its x and y values, and how many photos have both. */
function ScatterTooltip({
  data,
  ...props
}: {
  data: ScatterData;
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}) {
  const point = hovered<ScatterPoint>(props);
  if (!point) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <div className="font-medium">
        {data.xLabels[point.x]} · {data.yLabels[point.y]}
      </div>
      <div className="text-muted-foreground tabular-nums">
        {point.count.toLocaleString()} photos
      </div>
    </div>
  );
}
