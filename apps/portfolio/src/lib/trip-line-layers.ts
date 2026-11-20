import type { LayerProps } from "@vis.gl/react-maplibre";
import {
  areaEdgePaint,
  areaFillPaint,
  tripLinePaint,
  tripLineStyle,
} from "@portfolio/lib/map-theme";
import { LANE_OFFSET } from "@portfolio/lib/trip-lanes";

/** Only the segments' lines, not the trip stops or the areas. */
const IS_LINE = ["!", ["has", "feature"]];

/** The modes drawn in a style of their own, rather than as a ride in its line's color or a dashed hop. */
const OWN_STYLE = ["!", ["in", ["get", "mode"], ["literal", ["walk", "car", "ferry", "flight"]]]];

/**
 * A hop along a transit line: one with a line's name, or its color. A line with no color of its own,
 * such as one from Japan's rail map, is drawn solid in the ride blue, not dashed like a hop with none.
 */
const RIDDEN = ["any", ["has", "colour"], ["has", "line"]];

/**
 * Each layer of the trip lines, under the photos' markers: areas, then lines. Trip stops aren't drawn: they belong to the Trip pages. The
 * portfolio's map draws TRIPLINES.geo.json with them, and the pipeline's Trip page its Trip's days.
 */
export function tripLineLayers(dark: boolean): LayerProps[] {
  const style = (mode: string, onLine = false) => tripLineStyle(mode, { onLine }, dark);
  const ride = style("train", true);
  return [
    { id: "trip-fence-fill", type: "fill", filter: isFeature("fence"), paint: areaFillPaint(dark) },
    { id: "trip-fence-edge", type: "line", filter: isFeature("fence"), paint: areaEdgePaint(dark) },
    solidLayer("trip-walk", ["==", ["get", "mode"], "walk"], tripLinePaint(style("walk"))),
    solidLayer("trip-ride", ["all", OWN_STYLE, RIDDEN], {
      ...tripLinePaint(ride),
      "line-color": ["coalesce", ["get", "colour"], ride.color],
    }),
    solidLayer("trip-drive", ["==", ["get", "mode"], "car"], tripLinePaint(style("car"))),
    {
      id: "trip-ferry",
      type: "line",
      filter: ["all", IS_LINE, ["==", ["get", "mode"], "ferry"]],
      layout: ROUND,
      paint: { ...tripLinePaint(style("ferry")), "line-offset": LANE_OFFSET },
    },
    {
      id: "trip-flight",
      type: "line",
      filter: ["all", IS_LINE, ["==", ["get", "mode"], "flight"]],
      paint: { ...tripLinePaint(style("flight")), "line-offset": LANE_OFFSET },
    },
    {
      id: "trip-hop",
      type: "line",
      filter: ["all", IS_LINE, OWN_STYLE, ["!", RIDDEN]],
      paint: { ...tripLinePaint(style("train")), "line-offset": LANE_OFFSET },
    },
  ] as LayerProps[];
}

const ROUND = { "line-cap": "round", "line-join": "round" } as const;

/** A layer of solid lines matching `filter`, a little see-through, in its lane. */
function solidLayer(id: string, filter: unknown[], paint: object) {
  return {
    id,
    type: "line",
    filter: ["all", IS_LINE, filter],
    layout: ROUND,
    paint: { ...paint, "line-opacity": 0.85, "line-offset": LANE_OFFSET },
  };
}

/** A filter for the features marked `kind`. */
function isFeature(kind: "fence") {
  return ["==", ["get", "feature"], kind];
}
