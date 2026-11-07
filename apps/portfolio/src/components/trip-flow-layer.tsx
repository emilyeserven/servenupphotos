import { Layer, useMap } from "@vis.gl/react-maplibre";
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import { useEffect } from "react";
import { LANE_OFFSET } from "@/lib/trip-lanes";

/** The flow layer's ID. */
const FLOW = "trip-flow";

/** How long the light takes to run along a line, start to end, in milliseconds. */
const RUN_MS = 2400;

/** How much of a line the light's fading tail covers, as a share of its length. */
const TAIL = 0.3;

/** The light's color at its head: a bright white over the line's own color. */
const HEAD = "rgba(255, 255, 255, 0.95)";
const CLEAR = "rgba(255, 255, 255, 0)";

/**
 * The light along every line at `head`, a share of the way from its start (0) to its end (1): clear
 * behind its tail, brightening to the head, and clear past it. Stops that would fall outside the
 * line or repeat are left out, since MapLibre wants them in order.
 */
function flowGradient(head: number): ExpressionSpecification {
  const stops: [number, string][] = [
    [0, CLEAR],
    [head - TAIL, CLEAR],
    [head, HEAD],
    [head + 0.01, CLEAR],
    [1, CLEAR],
  ];
  const kept = stops.filter(([at], i) => at >= 0 && at <= 1 && (i === 0 || at > stops[i - 1]![0]));
  return ["interpolate", ["linear"], ["line-progress"], ...kept.flat()] as ExpressionSpecification;
}

/** The still version for people who turn motion off: each line brightening from its start to its end. */
const STILL: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["line-progress"],
  0,
  CLEAR,
  1,
  "rgba(255, 255, 255, 0.7)",
];

/** Whether the person asked their system for less motion. */
function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs the light along the lines, one run every RUN_MS with a short pause, until unmounted. */
function animate(map: MapLibreMap): () => void {
  let frame = 0;
  const start = performance.now();
  const step = (now: number) => {
    // A little past 1 so the tail runs off the end before the next run starts.
    const head = (((now - start) % RUN_MS) / RUN_MS) * (1 + TAIL);
    if (map.getLayer(FLOW)) map.setPaintProperty(FLOW, "line-gradient", flowGradient(head));
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** Moves the light along while the layer is on the map, unless motion is turned off. */
function useFlow() {
  const map = useMap().current?.getMap();
  useEffect(() => {
    if (!map || reducedMotion()) return;
    return animate(map);
  }, [map]);
}

/**
 * The way each trip line in the "trip-lines" source was travelled, shown like a ride app shows a
 * route: a light that runs along the line from where it started to where it ended, over and over.
 * The source needs `lineMetrics` for MapLibre to know how far along a line each point is.
 */
export function TripFlowLayer() {
  useFlow();
  return (
    <Layer
      id={FLOW}
      type="line"
      source="trip-lines"
      filter={["!", ["has", "feature"]]}
      layout={{ "line-cap": "round", "line-join": "round" }}
      paint={{
        "line-width": 3,
        "line-offset": LANE_OFFSET,
        "line-gradient": reducedMotion() ? STILL : flowGradient(0),
      }}
    />
  );
}
