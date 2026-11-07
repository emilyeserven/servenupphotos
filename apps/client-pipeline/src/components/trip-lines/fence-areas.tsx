import { areaEdgePaint, areaFillPaint } from "@portfolio/lib/map-theme";
import { Layer, type LayerProps, Source } from "@vis.gl/react-maplibre";
import type { AreaShape, TripFence } from "@/api/trip-lines";

/** The shaded inside of an area. */
function fillLayer(dark: boolean): LayerProps {
  return { id: "trip-fence-fill", type: "fill", paint: areaFillPaint(dark) };
}

/** An area's dashed edge. */
function edgeLayer(dark: boolean): LayerProps {
  return { id: "trip-fence-edge", type: "line", paint: areaEdgePaint(dark) };
}

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

/** The areas photos without an exact spot were taken in, shaded light blue with a dashed edge. */
export function FenceAreas({ fences, dark }: { fences: TripFence[]; dark: boolean }) {
  return (
    <Source id="trip-fences" type="geojson" data={fenceFeatures(fences)}>
      <Layer {...fillLayer(dark)} />
      <Layer {...edgeLayer(dark)} />
    </Source>
  );
}
