import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { ZoomIn } from "lucide-react";
import { type LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  type MouseEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MapDayFilter } from "@/components/map-day-filter";
import { MapViewControls } from "@/components/map-view-controls";
import { PhotoFilterControls } from "@/components/photo-filters";
import { MapFilterToggle } from "@/components/map-filter-toggle";
import { MapOverlay } from "@/components/map-overlay";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoLocation } from "@/components/photo-location";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { Button } from "@/components/ui/button";
import {
  type PlacedPhoto,
  boundsOf,
  placedPhotos,
  useDayPhotos,
  useMapPhotos,
} from "@/lib/map-photos";
import { type DayRange, daysInView, isDay } from "@/lib/map-days";
import { fadeTo } from "@/lib/map-fade";
import { type MapMarker, markersInView, photosInCluster, SOURCE_ID } from "@/lib/map-markers";
import { parseMapView, type MapViewSearch, useMapViewInUrl } from "@/lib/map-view";
import {
  filterCount,
  locationSelection,
  parseFilters,
  type PhotoFilters,
} from "@/lib/photo-filters";
import type { Photo, PhotoImage } from "@/lib/photos";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import { useTurn } from "@/lib/use-turn";
import { cn } from "@/lib/utils";

/**
 * The map's search: the shared filters, the open photo, where the map is looking, and the day only
 * the map narrows to, or the first day of a range with `to` as its last.
 */
type MapSearch = PhotoFilters & ShownPhotoSearch & MapViewSearch & { day?: string; to?: string };

/** The day, and the last day of the range when there's a day and it's after it. */
function daysOf(search: Record<string, unknown>): Pick<MapSearch, "day" | "to"> {
  if (!isDay(search.day)) return {};
  return isDay(search.to) && search.to > search.day
    ? { day: search.day, to: search.to }
    : { day: search.day };
}

export const Route = createFileRoute("/map")({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    ...parseFilters(search),
    ...daysOf(search),
    ...parseShownPhoto(search),
    ...parseMapView(search),
  }),
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

// The markers are HTML, drawn from the clusters MapLibre works out for the source. MapLibre only
// clusters a source a layer uses, so this one draws nothing.
const hiddenLayer: LayerProps = {
  id: "photo-points",
  type: "circle",
  source: SOURCE_ID,
  paint: { "circle-opacity": 0, "circle-stroke-opacity": 0 },
};

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

/**
 * How far from the map's edges the map keeps the photos it fits to, in pixels; more at the top,
 * where the title and controls cover it.
 */
const FIT_PADDING = { top: 140, right: 80, bottom: 80, left: 80 };

// Opens on the photos, close enough to see the streets around one photo but no closer; the whole
// world without any.
const ALL_PHOTOS_FIT = { padding: FIT_PADDING, maxZoom: 14 };
const WORLD_VIEW = { center: [20, 25] as [number, number], zoom: 1.3 };
/**
 * Where the map opens: where the URL says, as a link keeps it, or else on the photos' bounds, or
 * the whole world without any.
 */
function initialViewOf(bounds: LngLatBounds | null, view: MapViewSearch) {
  if (view.zoom !== undefined) return { longitude: view.lng, latitude: view.lat, zoom: view.zoom };
  return bounds
    ? { bounds, fitBoundsOptions: ALL_PHOTOS_FIT }
    : { longitude: WORLD_VIEW.center[0], latitude: WORLD_VIEW.center[1], zoom: WORLD_VIEW.zoom };
}

/** Moves the map to show every photo in the bounds, as when it opened. */
function showAllPhotos(map: MapRef, bounds: LngLatBounds | null) {
  fadeTo(map, (faded) => {
    if (bounds) faded.fitBounds(bounds, { ...ALL_PHOTOS_FIT, animate: false });
    else faded.jumpTo(WORLD_VIEW);
  });
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

function hasImage(photo: Photo): photo is ImagePhoto {
  return photo.image !== null;
}

/** A cluster that was clicked, with the photos it covers. */
interface OpenCluster {
  longitude: number;
  latitude: number;
  photos: PlacedPhoto[];
}

/** How many filters the map has set: the shared ones, and one more for a day or range of days. */
function setFilterCount(search: MapSearch): number {
  return filterCount(search) + (search.day ? 1 : 0);
}

/** Whether the places chosen before were all unchosen, leaving none. */
function placesCleared(before: string[], now: string[]): boolean {
  return before.length > 0 && now.length === 0;
}

/**
 * Moves the map to show the photos again when the filters change which photos it shows, and runs
 * `onChange` to close what's open. It doesn't move when the map first opens, as the map opens on
 * them already, or when every chosen place is unchosen, so the map stays on the place it showed
 * rather than zooming out to every photo. `places` are the places chosen in the Places filter.
 */
function useFitOnFilter(
  map: RefObject<MapRef | null>,
  { bounds, places }: { bounds: LngLatBounds | null; places: string[] },
  onChange: () => void,
) {
  const shownBounds = useRef(bounds);
  const shownPlaces = useRef(places);
  useEffect(() => {
    if (shownBounds.current === bounds || !map.current) return;
    shownBounds.current = bounds;
    if (!placesCleared(shownPlaces.current, places)) showAllPhotos(map.current, bounds);
    shownPlaces.current = places;
    onChange();
  });
}

/**
 * The photos the shared filters leave, which the map fits itself to, and of those the ones taken
 * on the day in the URL, which it draws.
 */
function useMapFilters() {
  const search = Route.useSearch();
  const mapPhotos = useMapPhotos(parseFilters(search));
  const dayPhotos = useDayPhotos(mapPhotos, search.day, search.to);
  return { search, mapPhotos, dayPhotos, setDays: useSetDays() };
}

/** Sets the days the map is narrowed to in the URL, keeping the other filters; no day for all. */
function useSetDays() {
  const navigate = useNavigate({ from: "/map" });
  return ({ day, to }: DayRange) => {
    void navigate({ search: (prev) => ({ ...prev, day, to }), replace: true });
  };
}

/**
 * The markers in view and what the map shows, for the day filter to list only the days of the
 * photos in view, with `updateMarkers` to work them out again after the map moves.
 */
function useMarkersInView(map: RefObject<MapRef | null>) {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [view, setView] = useState<LngLatBounds | null>(null);
  // Counts the updates, so a slower one finishing late doesn't replace a newer one's markers.
  const latest = useRef(0);
  async function updateMarkers() {
    if (!map.current) return;
    const update = ++latest.current;
    setView(map.current.getBounds());
    const next = await markersInView(map.current);
    if (update === latest.current) setMarkers(next);
  }
  return { markers, view, updateMarkers };
}

// Clicks on markers and in popups would otherwise reach the map too, which closes the popups.
function stopAtMarker(event: MouseEvent) {
  event.stopPropagation();
}

function MapView() {
  const isDark = useIsDark();
  const map = useRef<MapRef>(null);
  const { markers, view, updateMarkers } = useMarkersInView(map);
  // A photo without an image, shown in a popup as the lightbox can't show it.
  const [selected, setSelected] = useState<PlacedPhoto | null>(null);
  const [cluster, setCluster] = useState<OpenCluster | null>(null);
  const { shown, show, close } = useShownPhoto();
  const { search, mapPhotos, dayPhotos, setDays } = useMapFilters();
  const [initialViewState] = useState(() => initialViewOf(mapPhotos.bounds, search));
  const saveView = useMapViewInUrl(map, search);
  useFitOnFilter(map, { bounds: mapPhotos.bounds, places: locationSelection(search) }, () => {
    setSelected(null);
    setCluster(null);
  });
  // The photos the lightbox steps through: the open group's, or none for a photo on its own.
  const [shownGroup, setShownGroup] = useState<PlacedPhoto[]>([]);

  function onMoveEnd() {
    void updateMarkers();
    if (map.current) saveView(map.current);
  }

  function openPhoto(photo: PlacedPhoto, group: PlacedPhoto[] = []) {
    setShownGroup(group);
    if (hasImage(photo)) show(photo);
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
      <div className="min-h-0 flex-1">
        <Map
          ref={map}
          initialViewState={initialViewState}
          mapStyle={isDark ? MAP_STYLES.dark : MAP_STYLES.light}
          onMoveEnd={onMoveEnd}
          onSourceData={(event) => {
            if (event.sourceId === SOURCE_ID && event.isSourceLoaded) void updateMarkers();
          }}
          // Clicking empty map closes the popups.
          onClick={() => {
            setSelected(null);
            setCluster(null);
          }}
        >
          <NavigationControl position="bottom-right" />
          <MapOverlay count={dayPhotos.placed.length}>
            <MapViewControls
              onReset={() => {
                if (map.current) showAllPhotos(map.current, mapPhotos.bounds);
              }}
            >
              <MapFilterToggle count={setFilterCount(search)}>
                <MapDayFilter
                  days={daysInView(mapPhotos.placed, view)}
                  range={search}
                  onChange={setDays}
                />
                <PhotoFilterControls photos={placedPhotos} />
              </MapFilterToggle>
            </MapViewControls>
          </MapOverlay>
          <Source
            id={SOURCE_ID}
            type="geojson"
            data={dayPhotos.geoJson}
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
      <PhotoLightbox photo={shown} photos={shownGroup} onShow={show} onClose={close} />
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
    <Marker longitude={photo.longitude} latitude={photo.latitude} offset={marker.offset}>
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
          loading="lazy"
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
