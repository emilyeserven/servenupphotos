import { createFileRoute } from "@tanstack/react-router";
import {
  Layer,
  Map,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapRef,
  useMap,
} from "@vis.gl/react-maplibre";
import { format } from "date-fns";
import { MapPin, ZoomIn } from "lucide-react";
import { LngLatBounds, setWorkerUrl, type GeoJSONSource, type GeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { type MouseEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MapViewControls } from "@/components/map-view-controls";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoLocation } from "@/components/photo-location";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { Button } from "@/components/ui/button";
import { photos, type Photo, type PhotoImage } from "@/lib/photos";
import { useTurn } from "@/lib/use-turn";
import { cn } from "@/lib/utils";

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

// The markers are HTML, drawn from the clusters MapLibre works out for the source. MapLibre only
// clusters a source a layer uses, so this one draws nothing.
const hiddenLayer: LayerProps = {
  id: "photo-points",
  type: "circle",
  source: SOURCE_ID,
  paint: { "circle-opacity": 0, "circle-stroke-opacity": 0 },
};

interface PhotoPoint {
  type: "Point";
  coordinates: [number, number];
}

/** A photo with a GPS position, which is all the map can show. */
type PlacedPhoto = Photo & { latitude: number; longitude: number };

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

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

/** How far from the photos' edges the map keeps them, in pixels. */
const FIT_PADDING = 80;

/** The bounds of every photo, or null without any. */
function boundsOf(points: PlacedPhoto[]): LngLatBounds | null {
  if (points.length === 0) return null;
  const bounds = new LngLatBounds();
  for (const photo of points) bounds.extend([photo.longitude, photo.latitude]);
  return bounds;
}

const photoBounds = boundsOf(placedPhotos);

// Opens on the photos, close enough to see the streets around one photo but no closer; the whole
// world without any.
const ALL_PHOTOS_FIT = { padding: FIT_PADDING, maxZoom: 14 };
const WORLD_VIEW = { center: [20, 25] as [number, number], zoom: 1.3 };
const initialViewState = photoBounds
  ? { bounds: photoBounds, fitBoundsOptions: ALL_PHOTOS_FIT }
  : { longitude: WORLD_VIEW.center[0], latitude: WORLD_VIEW.center[1], zoom: WORLD_VIEW.zoom };

/** Moves the map back to where it opened, showing every photo. */
function showAllPhotos(map: MapRef) {
  if (photoBounds) map.fitBounds(photoBounds, ALL_PHOTOS_FIT);
  else map.flyTo(WORLD_VIEW);
}

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

/** A marker on the map: one photo, or a cluster of photos too close together to tell apart. */
type MapMarker =
  | { kind: "photo"; key: string; photo: PlacedPhoto }
  | {
      kind: "cluster";
      key: string;
      clusterId: number;
      count: number;
      longitude: number;
      latitude: number;
    };

/** The marker for one of the source's features, or null for a photo it doesn't know. */
function markerOf(feature: GeoJSONFeature): MapMarker | null {
  const properties = feature.properties ?? {};
  if (typeof properties.cluster_id !== "number") {
    const photo = photosById.get(properties.id);
    return photo ? { kind: "photo", key: `photo-${photo.id}`, photo } : null;
  }
  const [longitude, latitude] = (feature.geometry as PhotoPoint).coordinates;
  return {
    kind: "cluster",
    key: `cluster-${properties.cluster_id}`,
    clusterId: properties.cluster_id,
    count: properties.point_count,
    longitude,
    latitude,
  };
}

/** The markers for the clusters and photos in view, once each, as tiles can repeat them. */
function markersInView(map: MapRef): MapMarker[] {
  const markers = new globalThis.Map<string, MapMarker>();
  for (const feature of map.querySourceFeatures(SOURCE_ID)) {
    const marker = markerOf(feature);
    if (marker) markers.set(marker.key, marker);
  }
  return [...markers.values()];
}

/** The photos in a cluster, oldest first. */
async function photosInCluster(map: MapRef, clusterId: number): Promise<PlacedPhoto[]> {
  const source = map.getSource<GeoJSONSource>(SOURCE_ID);
  if (!source) return [];
  const leaves = await source.getClusterLeaves(clusterId, Infinity, 0);
  return leaves
    .flatMap((leaf) => photosById.get(leaf.properties?.id) ?? [])
    .toSorted((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
}

function hasImage(photo: Photo): photo is ImagePhoto {
  return photo.image !== null;
}

/** A cluster that was clicked, with the photos it covers. */
interface OpenCluster {
  longitude: number;
  latitude: number;
  photos: PlacedPhoto[];
}

// Clicks on markers and in popups would otherwise reach the map too, which closes the popups.
function stopAtMarker(event: MouseEvent) {
  event.stopPropagation();
}

function MapView() {
  const isDark = useIsDark();
  const map = useRef<MapRef>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  // A photo without an image, shown in a popup as the lightbox can't show it.
  const [selected, setSelected] = useState<PlacedPhoto | null>(null);
  const [cluster, setCluster] = useState<OpenCluster | null>(null);
  const [shown, setShown] = useState<ImagePhoto | null>(null);
  // The photos the lightbox steps through: the open group's, or none for a photo on its own.
  const [shownGroup, setShownGroup] = useState<PlacedPhoto[]>([]);

  function updateMarkers() {
    if (map.current) setMarkers(markersInView(map.current));
  }

  function openPhoto(photo: PlacedPhoto, group: PlacedPhoto[] = []) {
    setShownGroup(group);
    if (hasImage(photo)) setShown(photo);
    else setSelected(photo);
  }

  async function openCluster(marker: ClusterMarkerData) {
    if (!map.current) return;
    const clusterPhotos = await photosInCluster(map.current, marker.clusterId);
    setSelected(null);
    setCluster({ longitude: marker.longitude, latitude: marker.latitude, photos: clusterPhotos });
    // Brings the cluster to the middle, a little low, so its grid above it fits on a phone too.
    map.current.easeTo({ center: [marker.longitude, marker.latitude], offset: [0, 150] });
  }

  // Fitting the map to the cluster's photos splits it apart.
  function zoomIntoCluster(open: OpenCluster) {
    const bounds = boundsOf(open.photos);
    if (!bounds || !map.current) return;
    setCluster(null);
    map.current.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 18 });
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
          ref={map}
          initialViewState={initialViewState}
          mapStyle={isDark ? MAP_STYLES.dark : MAP_STYLES.light}
          onMoveEnd={updateMarkers}
          onSourceData={(event) => {
            if (event.sourceId === SOURCE_ID && event.isSourceLoaded) updateMarkers();
          }}
          // Clicking empty map closes the popups.
          onClick={() => {
            setSelected(null);
            setCluster(null);
          }}
        >
          <NavigationControl position="top-right" />
          <MapViewControls
            onReset={() => {
              if (map.current) showAllPhotos(map.current);
            }}
          />
          <Source
            id={SOURCE_ID}
            type="geojson"
            data={photoGeoJson}
            cluster
            clusterMaxZoom={17}
            clusterRadius={50}
          >
            <Layer {...hiddenLayer} />
          </Source>
          {markers.map((marker) => (
            <MapMarkerView
              key={marker.key}
              marker={marker}
              onOpenPhoto={openPhoto}
              onOpenCluster={(open) => void openCluster(open)}
            />
          ))}
          {cluster && (
            <Popup
              longitude={cluster.longitude}
              latitude={cluster.latitude}
              anchor="bottom"
              offset={24}
              maxWidth="none"
              onClose={() => setCluster(null)}
              className={MAP_POPUP}
            >
              <ClusterGrid
                cluster={cluster}
                onOpen={(photo) => openPhoto(photo, cluster.photos)}
                onZoomIn={() => zoomIntoCluster(cluster)}
              />
            </Popup>
          )}
          {selected && <PhotoPopup photo={selected} onClose={() => setSelected(null)} />}
        </Map>
      </div>
      <PhotoLightbox
        photo={shown}
        photos={shownGroup}
        onShow={setShown}
        onClose={() => setShown(null)}
      />
    </div>
  );
}

type ClusterMarkerData = Extract<MapMarker, { kind: "cluster" }>;

function MapMarkerView({
  marker,
  onOpenPhoto,
  onOpenCluster,
}: {
  marker: MapMarker;
  onOpenPhoto: (photo: PlacedPhoto) => void;
  onOpenCluster: (marker: ClusterMarkerData) => void;
}) {
  if (marker.kind === "cluster") {
    return (
      <Marker longitude={marker.longitude} latitude={marker.latitude}>
        <ClusterMarker
          clusterId={marker.clusterId}
          count={marker.count}
          onOpen={() => onOpenCluster(marker)}
        />
      </Marker>
    );
  }
  const { photo } = marker;
  return (
    <Marker longitude={photo.longitude} latitude={photo.latitude}>
      <PhotoMarker photo={photo} onOpen={() => onOpenPhoto(photo)} />
    </Marker>
  );
}

/** The details of a photo without an image yet, which the lightbox can't show. */
function PhotoPopup({ photo, onClose }: { photo: PlacedPhoto; onClose: () => void }) {
  return (
    <Popup
      longitude={photo.longitude}
      latitude={photo.latitude}
      anchor="bottom"
      offset={10}
      onClose={onClose}
      className={MAP_POPUP}
    >
      <p className="font-medium">{photo.title}</p>
      {photo.location && (
        <p className="text-xs text-neutral-600">
          <PhotoLocation location={photo.location} />
        </p>
      )}
      <p className="text-xs text-neutral-600">
        {format(photo.takenAt, "MMM d, yyyy")} · {photo.camera}
      </p>
    </Popup>
  );
}

// MapLibre styles its popups white, so dark mode recolors the box and its tip under the anchor.
// Its CSS isn't in a layer, so it beats Tailwind's utilities unless they're important. An outline,
// which MapLibre doesn't set, sets the box apart from the map.
const MAP_POPUP = cn(
  "text-neutral-900 dark:text-neutral-100",
  "[&_.maplibregl-popup-content]:outline [&_.maplibregl-popup-content]:outline-black/20 dark:[&_.maplibregl-popup-content]:outline-white/25",
  "dark:[&_.maplibregl-popup-content]:bg-neutral-900!",
  "dark:[&_.maplibregl-popup-tip]:border-t-neutral-900!",
  "dark:[&_.maplibregl-popup-close-button:hover]:bg-white/10!",
);

const MARKER_RING =
  "outline-none ring-2 ring-white shadow-md shadow-black/30 transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:ring-sky-500";

/** A photo's marker: its square thumbnail, or a dot for a photo without an image yet. */
function PhotoMarker({ photo, onOpen }: { photo: PlacedPhoto; onOpen: () => void }) {
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={(event) => {
        stopAtMarker(event);
        onOpen();
      }}
      className={cn(
        "block cursor-zoom-in overflow-hidden rounded-md bg-muted",
        photo.image ? "size-11" : "size-3.5 cursor-pointer rounded-full bg-sky-300",
        MARKER_RING,
        // A softer border for a photo placed at one of its places, as that spot is only near it.
        photo.approximatePosition && "ring-white/40",
      )}
    >
      {photo.image && <PhotoThumbnail image={photo.image} />}
    </button>
  );
}

/** How many of a cluster's photos its marker shows in turn, newest first. */
const CLUSTER_PREVIEWS = 3;
/** How long each of them shows, in milliseconds. */
const CLUSTER_PREVIEW_MS = 3000;

/** What a cluster's marker shows of the photos it covers. */
interface ClusterLook {
  /** The thumbnails of its newest photos with images, newest first. */
  previews: string[];
  /** Whether every photo in it is placed at one of its places, rather than its own GPS position. */
  approximate: boolean;
}

/** The newest thumbnails of a cluster, newest first, and whether all its photos are approximate. */
function clusterLook(clusterPhotos: PlacedPhoto[]): ClusterLook {
  const previews = clusterPhotos
    .flatMap(({ image }) => (image ? [image.thumbnail || image.small] : []))
    .toReversed()
    .slice(0, CLUSTER_PREVIEWS);
  return { previews, approximate: clusterPhotos.every((photo) => photo.approximatePosition) };
}

/** How a cluster's marker looks, once its photos have been read from the map. */
function useClusterLook(clusterId: number): ClusterLook {
  const { current: map } = useMap();
  const [look, setLook] = useState<ClusterLook>({ previews: [], approximate: false });
  useEffect(() => {
    if (!map) return;
    let current = true;
    void photosInCluster(map, clusterId).then((clusterPhotos) => {
      if (current) setLook(clusterLook(clusterPhotos));
    });
    return () => {
      current = false;
    };
  }, [map, clusterId]);
  return look;
}

/**
 * A cluster's marker: how many photos it covers, over its newest photos fading in and out in
 * turn, darkened so the number stays readable.
 */
function ClusterMarker({
  clusterId,
  count,
  onOpen,
}: {
  clusterId: number;
  count: number;
  onOpen: () => void;
}) {
  const { previews, approximate } = useClusterLook(clusterId);
  const turn = useTurn(previews.length, CLUSTER_PREVIEW_MS);
  return (
    <button
      type="button"
      title={`Show these ${count} photos`}
      onClick={(event) => {
        stopAtMarker(event);
        onOpen();
      }}
      className={cn(
        "relative flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-sky-300 text-sm font-semibold text-blue-950",
        previews.length > 0 && "bg-neutral-900 text-white",
        MARKER_RING,
        approximate && "ring-white/40",
      )}
    >
      {previews.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-1000",
            index === turn ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      {previews.length > 0 && <span aria-hidden className="absolute inset-0 bg-black/60" />}
      <span className="relative">{count}</span>
    </button>
  );
}

/** The photos a cluster covers, as square thumbnails that open in the lightbox. */
function ClusterGrid({
  cluster,
  onOpen,
  onZoomIn,
}: {
  cluster: OpenCluster;
  onOpen: (photo: PlacedPhoto) => void;
  onZoomIn: () => void;
}) {
  return (
    // Popup clicks would reach the map, which closes it.
    <div className="flex w-[min(19rem,calc(100vw-4rem))] flex-col gap-2" onClick={stopAtMarker}>
      <div className="flex items-center justify-between gap-2 pr-5">
        <p className="font-medium">{cluster.photos.length} photos</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          className="h-7 px-2 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ZoomIn aria-hidden />
          Zoom in
        </Button>
      </div>
      <ul className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto">
        {cluster.photos.map((photo) => (
          <li key={photo.id}>
            <button
              type="button"
              title={photo.title}
              aria-label={`Show ${photo.title}`}
              disabled={!photo.image}
              onClick={() => onOpen(photo)}
              className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-sm bg-neutral-200 outline-none dark:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-default"
            >
              {photo.image ? (
                <PhotoThumbnail image={photo.image} />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[0.65rem] leading-tight text-neutral-600 dark:text-neutral-400">
                  {photo.title}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
