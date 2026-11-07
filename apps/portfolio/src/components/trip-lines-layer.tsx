import { Layer, type LayerProps, Source } from "@vis.gl/react-maplibre";
import { format } from "date-fns";
import { useMemo } from "react";
import { areaEdgePaint, areaFillPaint, useIsDark } from "@/lib/map-theme";
import type { PlacedPhoto } from "@/lib/map-photos";
import { onDays, type TripLinesMap, useTripLinesMap } from "@/lib/trip-lines-map";

/** Only the segments' lines, not the places visited or the areas. */
const IS_LINE = ["!", ["has", "feature"]];

/** Colors that change with dark mode: the walking lines, and a hop with no line picked. */
function lineColors(dark: boolean) {
  return dark ? { walk: "#60a5fa", hop: "#c084fc" } : { walk: "#2563eb", hop: "#9333ea" };
}

/** Each layer of the trip lines, under the photos' markers: areas, then lines, then visits. */
function layers(dark: boolean): LayerProps[] {
  const colors = lineColors(dark);
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
      filter: ["all", IS_LINE, ["!=", ["get", "mode"], "walk"], ["has", "colour"]],
      layout: round,
      paint: { "line-color": ["get", "colour"], "line-width": 3, "line-opacity": 0.85 },
    },
    {
      id: "trip-hop",
      type: "line",
      filter: ["all", IS_LINE, ["!=", ["get", "mode"], "walk"], ["!", ["has", "colour"]]],
      paint: { "line-color": colors.hop, "line-width": 2, "line-dasharray": [2, 2] },
    },
    {
      id: "trip-visit",
      type: "circle",
      filter: isFeature("visit"),
      paint: {
        "circle-radius": 5,
        "circle-color": "#f59e0b",
        "circle-stroke-color": dark ? "#171717" : "#ffffff",
        "circle-stroke-width": 2,
      },
    },
  ] as LayerProps[];
}

/** A filter for the features marked `kind`. */
function isFeature(kind: "visit" | "fence") {
  return ["==", ["get", "feature"], kind];
}

/** The days the photos were taken, as TRIPLINES.geo.json writes them. */
function daysOf(photos: PlacedPhoto[]): Set<string> {
  return new Set(photos.map((p) => format(p.takenAt, "yyyy-MM-dd")));
}

/**
 * The trip lines of the days the map's photos were taken, from TRIPLINES.geo.json: walks in blue,
 * hops along a transit line in its color and others dashed, places visited as amber dots, and areas
 * shaded light blue. Nothing while `show` is off or there are none.
 */
export function TripLinesLayer({ photos, show }: { photos: PlacedPhoto[]; show: boolean }) {
  const map = useTripLinesMap(show);
  const dark = useIsDark();
  const data = useMemo(() => map && onDays(map, daysOf(photos)), [map, photos]);
  return data ? <TripLinesSource data={data} dark={dark} /> : null;
}

function TripLinesSource({ data, dark }: { data: TripLinesMap; dark: boolean }) {
  return (
    <Source id="trip-lines" type="geojson" data={data}>
      {layers(dark).map((layer) => (
        <Layer key={layer.id} {...layer} />
      ))}
    </Source>
  );
}
