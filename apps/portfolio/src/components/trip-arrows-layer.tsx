import { Layer, useMap } from "@vis.gl/react-maplibre";
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import { useEffect } from "react";
import { tripColors } from "@/lib/map-theme";

/** The name the arrow image is added to the map under. */
const ARROW = "trip-arrow";

/** The arrow image's size in pixels. */
const SIZE = 36;

/**
 * A chevron pointing right, drawn white on a canvas so MapLibre can tint it to each line's color
 * (an SDF image): the symbol layer turns it along the line, so it points the way travelled.
 */
function arrowImage(): ImageData | undefined {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(12, 8);
  ctx.lineTo(23, 18);
  ctx.lineTo(12, 28);
  ctx.stroke();
  return ctx.getImageData(0, 0, SIZE, SIZE);
}

/** Adds the arrow image to the map unless it has it, as after the basemap's style changes. */
function addArrow(map: MapLibreMap) {
  const image = map.hasImage(ARROW) ? undefined : arrowImage();
  if (image) map.addImage(ARROW, image, { sdf: true, pixelRatio: 2 });
}

/** Keeps the arrow image on the map, adding it again whenever a new style drops it. */
function useArrowImage() {
  const map = useMap().current?.getMap();
  useEffect(() => {
    if (!map) return;
    const add = () => addArrow(map);
    add();
    map.on("styledata", add);
    return () => {
      map.off("styledata", add);
    };
  }, [map]);
}

/** Each line's color, as the trip lines draw it: its transit line's color, or its mode's. */
function lineColor(dark: boolean): ExpressionSpecification {
  const colors = tripColors(dark);
  return [
    "case",
    ["has", "colour"],
    ["get", "colour"],
    [
      "match",
      ["get", "mode"],
      "walk",
      colors.walk,
      "car",
      colors.drive,
      "ferry",
      colors.ferry,
      "flight",
      colors.flight,
      colors.hop,
    ],
  ];
}

/**
 * Arrows along the trip lines in the "trip-lines" source, in each line's color, pointing the way it
 * was travelled: from its first point to its last.
 */
export function TripArrowsLayer({ dark }: { dark: boolean }) {
  useArrowImage();
  return (
    <Layer
      id="trip-arrows"
      type="symbol"
      source="trip-lines"
      filter={["!", ["has", "feature"]]}
      layout={{
        "symbol-placement": "line",
        "symbol-spacing": 90,
        "icon-image": ARROW,
        "icon-size": 1.3,
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      }}
      paint={{
        "icon-color": lineColor(dark),
        "icon-halo-color": dark ? "#171717" : "#ffffff",
        "icon-halo-width": 1,
      }}
    />
  );
}
