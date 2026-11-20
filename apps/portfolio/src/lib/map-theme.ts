import { useSyncExternalStore } from "react";

/**
 * The free CARTO basemaps for light and dark mode, which the portfolio's map and the pipeline's
 * trip line map share.
 */
export const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

// The theme provider toggles the `dark` class on <html>; follow it so the map matches.
function subscribeToDarkClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Whether the page is in dark mode, following the `dark` class on <html>. */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribeToDarkClass, () =>
    document.documentElement.classList.contains("dark"),
  );
}

/**
 * The light blue an area is drawn in (a place's area, or a trip line's area for photos without an
 * exact spot): Tailwind's sky, a stand-in for the Serven Up Websites brand blue, kept apart from the
 * walking lines' darker blue. Its edge is darker on the light basemap and lighter on the dark one.
 */
const AREA_COLORS = {
  light: { fill: "#38bdf8", edge: "#0284c7" },
  dark: { fill: "#38bdf8", edge: "#7dd3fc" },
};

/** An area's fill paint: more opaque while it's pointed at. */
export function areaFillPaint(dark: boolean, hovered = false) {
  const colors = areaColors(dark);
  return { "fill-color": colors.fill, "fill-opacity": hovered ? 0.35 : 0.22 };
}

/** An area's dashed edge paint. */
export function areaEdgePaint(dark: boolean) {
  const colors = areaColors(dark);
  return { "line-color": colors.edge, "line-width": 2, "line-dasharray": [3, 2] };
}

/**
 * The trip lines' colors that change with dark mode: walks, hops with no transit line picked, rides
 * on a transit line that has no color of its own (a deeper blue than walks), drives, a Trip's ferries and flights, and the edge around a place visited, which matches the
 * basemap. Places visited are amber in both.
 */
export function tripColors(dark: boolean) {
  return dark ? TRIP_COLORS.dark : TRIP_COLORS.light;
}

const TRIP_COLORS = {
  light: {
    walk: "#2563eb",
    hop: "#9333ea",
    ride: "#1e40af",
    drive: "#93c5fd",
    ferry: "#0d9488",
    flight: "#db2777",
    visit: "#f59e0b",
    visitEdge: "#ffffff",
  },
  dark: {
    walk: "#60a5fa",
    hop: "#c084fc",
    ride: "#3b82f6",
    drive: "#bfdbfe",
    ferry: "#2dd4bf",
    flight: "#f472b6",
    visit: "#f59e0b",
    visitEdge: "#171717",
  },
};

/** The colors of an area: its fill and its dashed edge. */
export function areaColors(dark: boolean) {
  return dark ? AREA_COLORS.dark : AREA_COLORS.light;
}

/**
 * How big a trip line is drawn: on a map (the portfolio's Map and the pipeline's Trip map), in the
 * pipeline's route map editor (walks and rides a little bolder, to see and click near while editing),
 * or in a small sketch (the Timeline's, a day's preview and a Trip card).
 */
export type TripLineSize = "map" | "editor" | "sketch";

/** The kinds of trip line drawn in a style of their own. */
type TripLineKind = "walk" | "ride" | "drive" | "ferry" | "flight" | "hop";

const TRIP_LINE_WIDTHS: Record<TripLineSize, Record<TripLineKind, number>> = {
  map: { walk: 3, ride: 3, drive: 3, ferry: 3, flight: 2, hop: 2 },
  editor: { walk: 4, ride: 4, drive: 3, ferry: 3, flight: 2, hop: 2 },
  sketch: { walk: 2, ride: 2, drive: 2, ferry: 2, flight: 1.5, hop: 1.5 },
};

/** The dashes of the dashed kinds, dash then gap, in line widths as MapLibre's `line-dasharray` takes them. */
const TRIP_LINE_DASHES: Partial<Record<TripLineKind, [number, number]>> = {
  ferry: [0.1, 2],
  flight: [3, 2],
  hop: [2, 2],
};

/** How a trip line is drawn: its color, its width in pixels, and its dashes when it's dashed. */
export interface TripLineStyle {
  color: string;
  width: number;
  /** Dash then gap, in line widths; left out for a solid line. */
  dash?: [number, number];
}

/** What a trip line is drawn by, besides its mode. */
export interface TripLineOf {
  /** Whether it's a hop along a transit line that was picked, drawn solid. */
  onLine?: boolean;
  /** Its line's color; left out, a ride is the ride blue and a hop the hop purple. */
  colour?: string;
}

/** The modes drawn in a kind of their own, whatever line they rode. */
const OWN_KINDS: Partial<Record<string, TripLineKind>> = {
  walk: "walk",
  car: "drive",
  ferry: "ferry",
  flight: "flight",
};

/**
 * How a trip line of `mode` is drawn, the one style every map and sketch of trip lines shares:
 * walks, drives and rides on a picked line are solid, a ferry dotted, and a flight and a hop with no
 * line picked dashed. A ride or hop is in its line's color when it has one.
 */
export function tripLineStyle(
  mode: string | undefined,
  { onLine = false, colour }: TripLineOf,
  dark: boolean,
  size: TripLineSize = "map",
): TripLineStyle {
  const kind = OWN_KINDS[mode ?? ""] ?? (onLine ? "ride" : "hop");
  const colors = tripColors(dark);
  const color = kind === "ride" || kind === "hop" ? (colour ?? colors[kind]) : colors[kind];
  const dash = TRIP_LINE_DASHES[kind];
  const width = TRIP_LINE_WIDTHS[size][kind];
  return dash ? { color, width, dash } : { color, width };
}

/** A trip line's style as MapLibre line paint. */
export function tripLinePaint(style: TripLineStyle) {
  const paint = { "line-color": style.color, "line-width": style.width };
  return style.dash ? { ...paint, "line-dasharray": style.dash } : paint;
}

/** A trip line's style as SVG stroke attributes, its dashes scaled to its width. */
export function tripLineStroke(style: TripLineStyle) {
  const stroke = { stroke: style.color, strokeWidth: style.width };
  if (!style.dash) return stroke;
  return { ...stroke, strokeDasharray: style.dash.map((d) => d * style.width).join(" ") };
}
