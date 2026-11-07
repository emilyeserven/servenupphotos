import type { LayerProps } from "@vis.gl/react-maplibre";
import { areaEdgePaint, areaFillPaint, tripColors } from "@portfolio/lib/map-theme";
import { LANE_OFFSET } from "@portfolio/lib/trip-lanes";

/** Only the segments' lines, not the trip stops or the areas. */
const IS_LINE = ["!", ["has", "feature"]];

/** The modes drawn in a style of their own, rather than as a ride in its line's color or a dashed hop. */
const OWN_STYLE = ["!", ["in", ["get", "mode"], ["literal", ["walk", "car", "ferry", "flight"]]]];

/**
 * Each layer of the trip lines, under the photos' markers: areas, then lines. Trip stops aren't drawn: they belong to the Trip pages. The
 * portfolio's map draws TRIPLINES.geo.json with them, and the pipeline's Trip page its Trip's days.
 */
export function tripLineLayers(dark: boolean): LayerProps[] {
  const colors = tripColors(dark);
  const round = { "line-cap": "round", "line-join": "round" } as const;
  return [
    { id: "trip-fence-fill", type: "fill", filter: isFeature("fence"), paint: areaFillPaint(dark) },
    { id: "trip-fence-edge", type: "line", filter: isFeature("fence"), paint: areaEdgePaint(dark) },
    {
      id: "trip-walk",
      type: "line",
      filter: ["all", IS_LINE, ["==", ["get", "mode"], "walk"]],
      layout: round,
      paint: {
        "line-color": colors.walk,
        "line-width": 3,
        "line-opacity": 0.85,
        "line-offset": LANE_OFFSET,
      },
    },
    {
      id: "trip-ride",
      type: "line",
      filter: ["all", IS_LINE, OWN_STYLE, ["has", "colour"]],
      layout: round,
      paint: {
        "line-color": ["get", "colour"],
        "line-width": 3,
        "line-opacity": 0.85,
        "line-offset": LANE_OFFSET,
      },
    },
    {
      id: "trip-drive",
      type: "line",
      filter: ["all", IS_LINE, ["==", ["get", "mode"], "car"]],
      paint: {
        "line-color": colors.drive,
        "line-width": 3,
        "line-dasharray": [4, 2],
        "line-offset": LANE_OFFSET,
      },
    },
    {
      id: "trip-ferry",
      type: "line",
      filter: ["all", IS_LINE, ["==", ["get", "mode"], "ferry"]],
      layout: round,
      paint: {
        "line-color": colors.ferry,
        "line-width": 3,
        "line-dasharray": [0.1, 2],
        "line-offset": LANE_OFFSET,
      },
    },
    {
      id: "trip-flight",
      type: "line",
      filter: ["all", IS_LINE, ["==", ["get", "mode"], "flight"]],
      paint: {
        "line-color": colors.flight,
        "line-width": 2,
        "line-dasharray": [3, 2],
        "line-offset": LANE_OFFSET,
      },
    },
    {
      id: "trip-hop",
      type: "line",
      filter: ["all", IS_LINE, OWN_STYLE, ["!", ["has", "colour"]]],
      paint: {
        "line-color": colors.hop,
        "line-width": 2,
        "line-dasharray": [2, 2],
        "line-offset": LANE_OFFSET,
      },
    },
  ] as LayerProps[];
}

/** A filter for the features marked `kind`. */
function isFeature(kind: "fence") {
  return ["==", ["get", "feature"], kind];
}
