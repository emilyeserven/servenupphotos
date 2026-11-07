import { Layer, type LayerProps, Source } from "@vis.gl/react-maplibre";
import { type ShownArea, usePlaceArea } from "@/lib/place-areas";

/** The area's fill: stronger while the place is pointed at in the Places menu. */
function fillLayer(hovered: boolean): LayerProps {
  return {
    id: "place-area-fill",
    type: "fill",
    paint: { "fill-color": "#9333ea", "fill-opacity": hovered ? 0.22 : 0.12 },
  };
}

/** The area's edge. */
const edgeLayer: LayerProps = {
  id: "place-area-edge",
  type: "line",
  paint: { "line-color": "#9333ea", "line-width": 2, "line-dasharray": [3, 2] },
};

/**
 * The shown place's area, shaded with a dashed edge, under the photos' markers; nothing when the
 * place has no area file or none is shown.
 */
export function PlaceAreaLayer({ id, hovered }: ShownArea) {
  const feature = usePlaceArea(id);
  if (!feature) return null;
  return (
    <Source id="place-area" type="geojson" data={feature}>
      <Layer {...fillLayer(hovered)} />
      <Layer {...edgeLayer} />
    </Source>
  );
}
