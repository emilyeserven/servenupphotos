import type { ReactNode } from "react";
import { formatValue, type GraphDatum, type GraphSeries, type Measure } from "@/lib/graph-data";

/** A colored square naming a series, beside its label. */
function Swatch({ color }: { color: string }) {
  return (
    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} aria-hidden />
  );
}

/** A series or slice in the graph's key. */
type KeyItem = Pick<GraphSeries, "label" | "color">;

/**
 * A graph with its key: each series or slice with its color in a column on the right, so the y
 * axis stays on its own, or under the graph on phones. Without items, just the graph.
 */
export function WithKey({ items, children }: { items: KeyItem[]; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">{children}</div>
      {items.length > 0 && <GraphLegend items={items} />}
    </div>
  );
}

/** The graph's key: its items in a wrapping row on phones, a column beside the graph past them. */
function GraphLegend({ items }: { items: KeyItem[] }) {
  return (
    <ul
      aria-label="Key"
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:w-36 sm:shrink-0 sm:flex-col sm:pt-2"
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch color={item.color} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** A value along the x axis as the axis writes it, cut short past 14 letters. */
export function shortLabel(label: string): string {
  return label.length > 14 ? `${label.slice(0, 13)}…` : label;
}

/** What recharts hands a tooltip: whether it shows, and the hovered datum under `payload`. */
interface TooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

/** The hovered datum, when the tooltip shows. */
export function hovered<T>({ active, payload }: TooltipProps): T | undefined {
  return active ? (payload?.[0]?.payload as T | undefined) : undefined;
}

/** How the graph's tooltips look. */
export const TOOLTIP_CLASS =
  "grid min-w-36 gap-1 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl";

/**
 * The tooltip of a bar, line point or slice: its value, how many photos it has, and the number for
 * each series that has any.
 */
export function GraphTooltip({
  series,
  measure,
  ...props
}: TooltipProps & { series: GraphSeries[]; measure: Measure }) {
  const datum = hovered<GraphDatum & Record<string, number>>(props);
  if (!datum) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <div className="font-medium">{datum.label}</div>
      <div className="text-muted-foreground tabular-nums">
        {datum.photos.toLocaleString()} photos
      </div>
      {series.length > 1 ? (
        <SeriesValues series={series} datum={datum} measure={measure} />
      ) : (
        <Share datum={datum} measure={measure} />
      )}
    </div>
  );
}

/** An unsplit value's share of the photos, when that's what the graph measures. */
function Share({ datum, measure }: { datum: Record<string, number>; measure: Measure }) {
  if (measure !== "percent") return null;
  return <div className="tabular-nums">{formatValue(datum.value ?? 0, measure)} of the photos</div>;
}

/** Each series' number in a tooltip, the ones with none left out. */
function SeriesValues({
  series,
  datum,
  measure,
}: {
  series: GraphSeries[];
  datum: Record<string, number>;
  measure: Measure;
}) {
  return (
    <ul className="mt-1 grid gap-0.5">
      {series
        .filter((s) => (datum[s.key] ?? 0) > 0)
        .map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <Swatch color={s.color} />
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums">{formatValue(datum[s.key]!, measure)}</span>
          </li>
        ))}
    </ul>
  );
}
