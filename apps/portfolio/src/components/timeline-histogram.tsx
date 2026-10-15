import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceArea, XAxis, YAxis } from "recharts";
import type { MouseHandlerDataParam } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { HistogramBin, HistogramResolution } from "@/lib/histogram";

const chartConfig = {
  count: { label: "Photos", color: "var(--chart-2)" },
} satisfies ChartConfig;

interface Drag {
  anchor: number;
  current: number;
}

function sortedRange({ anchor, current }: Drag): [number, number] {
  return anchor <= current ? [anchor, current] : [current, anchor];
}

function hoveredIndex(state: MouseHandlerDataParam) {
  const index = Number(state.activeTooltipIndex);
  return Number.isInteger(index) ? index : undefined;
}

function plural(count: number) {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

/** The span being dragged across, as one label, and its total photo count. */
function summarizeDrag(bins: HistogramBin[], drag: Drag) {
  const [lo, hi] = sortedRange(drag);
  const count = bins.slice(lo, hi + 1).reduce((sum, bin) => sum + bin.count, 0);
  const label = [...new Set([bins[lo], bins[hi]].map((bin) => bin?.label))].join(" – ");
  return { label, count };
}

/**
 * A photo-count histogram over the current time range. Click a bar to select that day or month,
 * or click and drag across bars to select a span, like drag-to-zoom on a Grafana graph.
 */
export function TimelineHistogram({
  bins,
  resolution,
  onSelect,
}: {
  bins: HistogramBin[];
  resolution: HistogramResolution;
  onSelect: (start: Date, end: Date) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);

  function handleMouseDown(state: MouseHandlerDataParam) {
    const index = hoveredIndex(state);
    if (index !== undefined) setDrag({ anchor: index, current: index });
  }

  function handleMouseMove(state: MouseHandlerDataParam) {
    const index = hoveredIndex(state);
    if (index !== undefined) setDrag((current) => current && { ...current, current: index });
  }

  function handleMouseUp() {
    const [lo, hi] = drag ? sortedRange(drag) : [-1, -1];
    const first = bins[lo];
    const last = bins[hi];
    setDrag(null);
    if (first && last) onSelect(first.start, last.end);
  }

  // While dragging, the tooltip describes the whole span instead of the hovered bar.
  const span = drag ? summarizeDrag(bins, drag) : undefined;

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4 text-xs text-muted-foreground">
        <figcaption>Photos per {resolution}</figcaption>
        <span>Click a bar or drag across bars to select a range</span>
      </div>
      <ChartContainer config={chartConfig} className="aspect-auto h-40 w-full select-none">
        <BarChart
          data={bins}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          barCategoryGap={1}
          className="cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setDrag(null)}
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="tick" tickLine={false} axisLine={false} minTickGap={32} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
          <ChartTooltip
            isAnimationActive={false}
            content={
              <ChartTooltipContent
                labelFormatter={(bin) => span?.label ?? (bin as HistogramBin).label}
                valueFormatter={(value) => plural(span?.count ?? Number(value))}
              />
            }
          />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
          {drag && <SelectionArea bins={bins} drag={drag} />}
        </BarChart>
      </ChartContainer>
    </figure>
  );
}

function SelectionArea({ bins, drag }: { bins: HistogramBin[]; drag: Drag }) {
  const [lo, hi] = sortedRange(drag);
  return (
    <ReferenceArea
      x1={bins[lo]?.tick}
      x2={bins[hi]?.tick}
      fill="var(--foreground)"
      fillOpacity={0.08}
    />
  );
}
