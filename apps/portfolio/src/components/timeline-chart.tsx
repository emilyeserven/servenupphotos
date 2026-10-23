import { Link } from "@tanstack/react-router";
import { min } from "date-fns";
import { CalendarDays, ChartColumn } from "lucide-react";
import { TimelineHeatmap, type DayRange } from "@/components/timeline-heatmap";
import { TimelineHistogram } from "@/components/timeline-histogram";
import { buildHeatmap } from "@/lib/heatmap";
import { buildHistogram } from "@/lib/histogram";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/** How the Timeline charts its photos: a bar graph of the range, or a heatmap of every day. */
export type ChartMode = "graph" | "heatmap";

const CHART_MODES = [
  {
    mode: "graph",
    label: "Graph",
    Icon: ChartColumn,
    title: "Photos per day or month in the range",
  },
  { mode: "heatmap", label: "Heatmap", Icon: CalendarDays, title: "Photos per day, by year" },
] as const;

/**
 * The Timeline's chart and the buttons to switch it between the bar graph, which covers the
 * selected range, and the heatmap, which covers every year and fades the days outside it.
 */
export function TimelineChart({
  mode,
  inRange,
  all,
  start,
  end,
  now,
  shown,
  onSelect,
}: {
  mode: ChartMode;
  /** The dates of the photos in the selected range, for the graph. */
  inRange: Date[];
  /** The dates of every photo the filters let through, for the heatmap. */
  all: Date[];
  start: Date;
  end: Date;
  /** Today, the heatmap's last day; its first is the oldest photo's. */
  now: Date;
  /** The selected range's days, for the heatmap to fade the rest; left out for "All time". */
  shown?: DayRange;
  onSelect: (from: Date, to: Date) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <ChartModeSwitcher mode={mode} />
      {mode === "heatmap" ? (
        <TimelineHeatmap
          years={buildHeatmap(all, all.length > 0 ? min(all) : now, now)}
          shown={shown}
          onSelect={onSelect}
        />
      ) : (
        <TimelineHistogram {...buildHistogram(inRange, start, end)} onSelect={onSelect} />
      )}
    </section>
  );
}

/** Buttons to switch the chart, kept in the URL as `?chart=heatmap` so a link keeps it. */
function ChartModeSwitcher({ mode }: { mode: ChartMode }) {
  return (
    <div role="group" aria-label="Chart" className={`${CONTROL_FRAME} self-end`}>
      {CHART_MODES.map(({ mode: option, label, Icon, title }) => (
        <Link
          key={option}
          from="/timeline"
          to="/timeline"
          search={(prev) => ({ ...prev, chart: option === "heatmap" ? "heatmap" : undefined })}
          replace
          aria-pressed={mode === option}
          title={title}
          className={controlButtonClass(mode === option)}
        >
          <Icon aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}
