import { createFileRoute } from "@tanstack/react-router";
import {
  Layer,
  Map,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
} from "@vis.gl/react-maplibre";
import { format } from "date-fns";
import { MapPin } from "lucide-react";
import { LngLatBounds, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useState, useSyncExternalStore } from "react";
import { photos, type Photo } from "@/lib/photos";

export const Route = createFileRoute("/map")({
  component: MapView,
});

// MapLibre finds its worker next to its own module, which Vite moves when bundling, so point it
// at a worker Vite builds for us instead.
setWorkerUrl(maplibreWorkerUrl);

// Free CARTO basemaps; no API key needed, attribution is shown by the map.
const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const SOURCE_ID = "photos";
const CLUSTER_LAYER_ID = "photo-clusters";
const PHOTO_LAYER_ID = "photo-points";
// Matches --chart-1 in styles.css; MapLibre paint properties can't read CSS variables.
const POINT_COLOR = "#8ec5ff";
const POINT_STROKE = "#1c398e";

const clusterLayer: LayerProps = {
  id: CLUSTER_LAYER_ID,
  type: "circle",
  source: SOURCE_ID,
  filter: ["has", "point_count"],
  paint: {
    "circle-color": POINT_COLOR,
    "circle-opacity": 0.85,
    "circle-stroke-color": POINT_STROKE,
    "circle-stroke-width": 1,
    "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 24],
  },
};

const clusterCountLayer: LayerProps = {
  id: "photo-cluster-count",
  type: "symbol",
  source: SOURCE_ID,
  filter: ["has", "point_count"],
  layout: {
    "text-field": "{point_count_abbreviated}",
    "text-size": 12,
  },
  paint: { "text-color": POINT_STROKE },
};

const photoLayer: LayerProps = {
  id: PHOTO_LAYER_ID,
  type: "circle",
  source: SOURCE_ID,
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": POINT_COLOR,
    "circle-stroke-color": POINT_STROKE,
    "circle-stroke-width": 1.5,
    "circle-radius": 6,
  },
};

interface PhotoPoint {
  type: "Point";
  coordinates: [number, number];
}

/** A photo with a GPS position, which is all the map can show. */
type PlacedPhoto = Photo & { latitude: number; longitude: number };

const placedPhotos = photos.filter(
  (photo): photo is PlacedPhoto => photo.latitude !== null && photo.longitude !== null,
);

const photoGeoJson = {
  type: "FeatureCollection" as const,
  features: placedPhotos.map((photo) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point",
      coordinates: [photo.longitude, photo.latitude],
    } satisfies PhotoPoint,
    properties: { id: photo.id },
  })),
};

const photosById = new globalThis.Map(placedPhotos.map((photo) => [photo.id, photo]));

// The theme provider toggles the `dark` class on <html>; follow it so the basemap matches.
function subscribeToDarkClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function useIsDark() {
  return useSyncExternalStore(subscribeToDarkClass, () =>
    document.documentElement.classList.contains("dark"),
  );
}

function clickedProperties(event: MapLayerMouseEvent) {
  return event.features?.[0]?.properties ?? {};
}

// Clicking a cluster fits the map to the photos inside it, which splits it apart.
async function zoomIntoCluster(event: MapLayerMouseEvent, clusterId: number) {
  const map = event.target;
  const source = map.getSource<GeoJSONSource>(SOURCE_ID);
  if (!source) return;
  const leaves = await source.getClusterLeaves(clusterId, Infinity, 0);
  const bounds = new LngLatBounds();
  // Leaves come back as the original GeoJSON points, at full precision.
  for (const leaf of leaves) bounds.extend((leaf.geometry as PhotoPoint).coordinates);
  map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
}

function MapView() {
  const isDark = useIsDark();
  const [selected, setSelected] = useState<PlacedPhoto | null>(null);

  // Clicking empty map has no features, which clears the popup.
  function handleClick(event: MapLayerMouseEvent) {
    const { cluster_id: clusterId, id } = clickedProperties(event);
    if (typeof clusterId === "number") {
      void zoomIntoCluster(event, clusterId);
      return;
    }
    setSelected(photosById.get(id) ?? null);
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-6 pr-16 sm:px-6">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <MapPin className="size-8 text-muted-foreground" aria-hidden />
          Map
        </h1>
        <p className="text-sm text-muted-foreground">{placedPhotos.length} photos</p>
      </header>
      <div className="min-h-0 flex-1">
        <Map
          initialViewState={{ longitude: 20, latitude: 25, zoom: 1.3 }}
          mapStyle={isDark ? MAP_STYLES.dark : MAP_STYLES.light}
          interactiveLayerIds={[CLUSTER_LAYER_ID, PHOTO_LAYER_ID]}
          onClick={handleClick}
        >
          <NavigationControl position="top-right" />
          <Source
            id={SOURCE_ID}
            type="geojson"
            data={photoGeoJson}
            cluster
            clusterMaxZoom={14}
            clusterRadius={40}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...photoLayer} />
          </Source>
          {selected && (
            <Popup
              longitude={selected.longitude}
              latitude={selected.latitude}
              anchor="bottom"
              offset={10}
              onClose={() => setSelected(null)}
              className="text-neutral-900"
            >
              <p className="font-medium">{selected.title}</p>
              <p className="text-xs text-neutral-600">{selected.location}</p>
              <p className="text-xs text-neutral-600">
                {format(selected.takenAt, "MMM d, yyyy")} · {selected.camera}
              </p>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}
