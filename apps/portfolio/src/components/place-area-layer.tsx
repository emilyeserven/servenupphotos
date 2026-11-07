import { Layer, type LayerProps, Source } from "@vis.gl/react-maplibre";
import { areaEdgePaint, areaFillPaint, useIsDark } from "@/lib/map-theme";
import { type ShownArea, usePlaceArea } from "@/lib/place-areas";

/** The area's fill: stronger while the place is pointed at in the Places menu. */
function fillLayer(dark: boolean, hovered: boolean): LayerProps {
  return { id: "place-area-fill", type: "fill", paint: areaFillPaint(dark, hovered) };
}

/** The area's dashed edge. */
function edgeLayer(dark: boolean): LayerProps {
  return { id: "place-area-edge", type: "line", paint: areaEdgePaint(dark) };
}

/**
 * The shown place's area, shaded with a dashed edge, under the photos' markers; nothing when the
 * place has no area file or none is shown.
 */
export function PlaceAreaLayer({ id, hovered }: ShownArea) {
  const feature = usePlaceArea(id);
  const dark = useIsDark();
  if (!feature) return null;
  return (
    <Source id="place-area" type="geojson" data={feature}>
      <Layer {...fillLayer(dark, hovered)} />
      <Layer {...edgeLayer(dark)} />
    </Source>
  );
}
