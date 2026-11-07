import { Layer, type LayerProps, Source } from "@vis.gl/react-maplibre";
import type { AreaShape, TripFence } from "@/api/trip-lines";

/** The shaded inside of an area. */
const fillLayer: LayerProps = {
  id: "trip-fence-fill",
  type: "fill",
  paint: { "fill-color": "#9333ea", "fill-opacity": 0.12 },
};

/** An area's dashed edge. */
const edgeLayer: LayerProps = {
  id: "trip-fence-edge",
  type: "line",
  paint: { "line-color": "#9333ea", "line-width": 2, "line-dasharray": [3, 2] },
};

/** A fence as a GeoJSON feature. */
interface FenceFeature {
  type: "Feature";
  geometry: { type: "MultiPolygon"; coordinates: AreaShape };
  properties: { name: string; photos: number };
}

/** The fences as a GeoJSON FeatureCollection of MultiPolygons. */
function fenceFeatures(fences: TripFence[]): {
  type: "FeatureCollection";
  features: FenceFeature[];
} {
  return {
    type: "FeatureCollection",
    features: fences.map((f) => ({
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: f.shape },
      properties: { name: f.name, photos: f.photos.length },
    })),
  };
}

/** The areas photos without an exact spot were taken in, shaded with a dashed edge. */
export function FenceAreas({ fences }: { fences: TripFence[] }) {
  return (
    <Source id="trip-fences" type="geojson" data={fenceFeatures(fences)}>
      <Layer {...fillLayer} />
      <Layer {...edgeLayer} />
    </Source>
  );
}
