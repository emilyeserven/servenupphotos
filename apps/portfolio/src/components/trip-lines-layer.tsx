import { Layer, type LayerProps, Source } from "@vis.gl/react-maplibre";
import { TripFlowLayer } from "@/components/trip-flow-layer";
import { areaEdgePaint, areaFillPaint, tripColors, useIsDark } from "@/lib/map-theme";
import type { PlacedPhoto } from "@/lib/map-photos";
import { type TripLinesMap, useShownTripLines } from "@/lib/trip-lines-map";

/** Only the segments' lines, not the places visited or the areas. */
const IS_LINE = ["!", ["has", "feature"]];

/** The modes drawn in a style of their own, rather than as a ride in its line's color or a dashed hop. */
const OWN_STYLE = ["!", ["in", ["get", "mode"], ["literal", ["walk", "car", "ferry", "flight"]]]];

/** Each layer of the trip lines, under the photos' markers: areas, then lines, then visits. */
function layers(dark: boolean): LayerProps[] {
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
      paint: { "line-color": colors.walk, "line-width": 3, "line-opacity": 0.85 },
    },
    {
      id: "trip-ride",
      type: "line",
      filter: ["all", IS_LINE, OWN_STYLE, ["has", "colour"]],
      layout: round,
      paint: { "line-color": ["get", "colour"], "line-width": 3, "line-opacity": 0.85 },
    },
    {
      id: "trip-drive",
      type: "line",
      filter: ["all", IS_LINE, ["==", ["get", "mode"], "car"]],
      paint: { "line-color": colors.drive, "line-width": 3, "line-dasharray": [4, 2] },
    },
    {
      id: "trip-ferry",
      type: "line",
      filter: ["all", IS_LINE, ["==", ["get", "mode"], "ferry"]],
      layout: round,
      paint: { "line-color": colors.ferry, "line-width": 3, "line-dasharray": [0.1, 2] },
    },
    {
      id: "trip-flight",
      type: "line",
      filter: ["all", IS_LINE, ["==", ["get", "mode"], "flight"]],
      paint: { "line-color": colors.flight, "line-width": 2, "line-dasharray": [3, 2] },
    },
    {
      id: "trip-hop",
      type: "line",
      filter: ["all", IS_LINE, OWN_STYLE, ["!", ["has", "colour"]]],
      paint: { "line-color": colors.hop, "line-width": 2, "line-dasharray": [2, 2] },
    },
    {
      id: "trip-visit",
      type: "circle",
      filter: isFeature("visit"),
      paint: {
        "circle-radius": 5,
        "circle-color": colors.visit,
        "circle-stroke-color": colors.visitEdge,
        "circle-stroke-width": 2,
      },
    },
  ] as LayerProps[];
}

/** A filter for the features marked `kind`. */
function isFeature(kind: "visit" | "fence") {
  return ["==", ["get", "feature"], kind];
}

/**
 * The trip lines of the days the map's photos were taken, from TRIPLINES.geo.json: walks in blue,
 * drives in long gray dashes, a Trip's ferries in teal dots and flights as pink dashed arcs, hops along a transit line in its color and others dashed, places visited as amber dots, and areas
 * shaded light blue, with a light running along each line the way it was travelled when `flow` is on. Nothing while
 * `show` is off or there are none.
 */
export function TripLinesLayer({
  photos,
  show,
  flow,
}: {
  photos: PlacedPhoto[];
  show: boolean;
  /** Whether a light runs along each line the way it was travelled. */
  flow: boolean;
}) {
  const data = useShownTripLines(photos, show);
  const dark = useIsDark();
  return data ? <TripLinesSource data={data} dark={dark} flow={flow} /> : null;
}

interface TripLinesSourceProps {
  data: TripLinesMap;
  dark: boolean;
  flow: boolean;
}

function TripLinesSource({ data, dark, flow }: TripLinesSourceProps) {
  return (
    <Source id="trip-lines" type="geojson" data={data} lineMetrics>
      {layers(dark).map((layer) => (
        <Layer key={layer.id} {...layer} />
      ))}
      {flow && <TripFlowLayer />}
    </Source>
  );
}
