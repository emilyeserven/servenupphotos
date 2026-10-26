import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Layer,
  Map,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapRef,
} from "@vis.gl/react-maplibre";
import { format } from "date-fns";
import { MapPin } from "lucide-react";
import { type LngLatBounds, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { type RefObject, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MapDayFilter } from "@/components/map-day-filter";
import { MapViewControls } from "@/components/map-view-controls";
import { PhotoFilterControls } from "@/components/photo-filters";
import { MapFilterToggle } from "@/components/map-filter-toggle";
import { FloatingHeader } from "@/components/floating-header";
import { ClusterGrid, ClusterSheet, type OpenCluster } from "@/components/map-cluster";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoLocation } from "@/components/photo-location";
import { mapViewOf } from "@/components/view-on-map-link";
import { ViewInGridButton } from "@/components/view-in-grid-button";
import { MapDisplayOptions } from "@/components/map-display-options";
import { type ClusterMarkerData, MapMarkerView } from "@/components/map-marker-view";
import {
  type PlacedPhoto,
  boundsOf,
  placedById,
  placedPhotos,
  useDayPhotos,
  useMapPhotos,
} from "@/lib/map-photos";
import { type DayRange, daysInView, isDay } from "@/lib/map-days";
import { type MapDisplay, pinSpacing, useMapDisplay } from "@/lib/map-display";
import { fadeTo } from "@/lib/map-fade";
import { gridFiltersFor } from "@/lib/map-grid-link";
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
import { useMediaQuery } from "@/lib/use-media-query";
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
 * Where the URL says the map should open: its center and zoom as a link keeps them, or else
 * zoomed in on the open photo, so a link to a photo doesn't fly in from every photo; null when it
 * says neither.
 */
function linkedViewOf(search: MapViewSearch & ShownPhotoSearch): Required<MapViewSearch> | null {
  if (search.zoom !== undefined) return search as Required<MapViewSearch>;
  const photo = search.photo === undefined ? undefined : placedById.get(search.photo);
  return photo ? mapViewOf(photo) : null;
}

/**
 * Where the map opens: where the URL says (linkedViewOf), or else on the photos' bounds, or the
 * whole world without any.
 */
function initialViewOf(bounds: LngLatBounds | null, search: MapViewSearch & ShownPhotoSearch) {
  const view = linkedViewOf(search);
  if (view) return { longitude: view.lng, latitude: view.lat, zoom: view.zoom };
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
 * photos in view, with `updateMarkers` to work them out again after the map moves. Photo markers
 * are kept `spacing` pixels apart, or as far as `updateMarkers` is told.
 */
function useMarkersInView(map: RefObject<MapRef | null>, spacing: number) {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [view, setView] = useState<LngLatBounds | null>(null);
  // Counts the updates, so a slower one finishing late doesn't replace a newer one's markers.
  const latest = useRef(0);
  async function updateMarkers(apart = spacing) {
    if (!map.current) return;
    const update = ++latest.current;
    setView(map.current.getBounds());
    const next = await markersInView(map.current, apart);
    if (update === latest.current) setMarkers(next);
  }
  return { markers, view, updateMarkers };
}

/**
 * The markers in view, drawn as the display options say, with `changeDisplay` to change those;
 * changing the pin size moves the photo markers apart by the new size.
 */
function useMarkersOnDisplay(map: RefObject<MapRef | null>) {
  const [display, setDisplay] = useMapDisplay();
  const inView = useMarkersInView(map, pinSpacing(display.pinSize));
  function changeDisplay(change: Partial<MapDisplay>) {
    setDisplay(change);
    if (change.pinSize) void inView.updateMarkers(pinSpacing(change.pinSize));
  }
  return { ...inView, display, changeDisplay };
}

function MapView() {
  const isDark = useIsDark();
  const map = useRef<MapRef>(null);
  const { markers, view, updateMarkers, display, changeDisplay } = useMarkersOnDisplay(map);
  // A photo without an image, shown in a popup as the lightbox can't show it.
  const [selected, setSelected] = useState<PlacedPhoto | null>(null);
  const [cluster, setCluster] = useState<OpenCluster | null>(null);
  const phone = useMediaQuery(PHONE_QUERY);
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

  // Clicking a group zooms in to fit its photos, which splits it apart. A group that zooming in
  // can't split, such as many photos at one place, shows its photos in a grid instead.
  async function openCluster(marker: ClusterMarkerData) {
    if (!map.current) return;
    const clusterPhotos = await photosInCluster(map.current, marker.clusterId);
    setSelected(null);
    const zoom = zoomToFit(map.current, clusterPhotos);
    if (zoom) {
      setCluster(null);
      map.current.fitBounds(zoom, CLUSTER_FIT);
      return;
    }
    setCluster({ longitude: marker.longitude, latitude: marker.latitude, photos: clusterPhotos });
    // Brings the group to the middle: a little low so its popup fits above it, or on phones a
    // little high so it stays clear of the sheet along the bottom.
    map.current.easeTo({
      center: [marker.longitude, marker.latitude],
      offset: clusterOffset(phone),
    });
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
          <FloatingHeader icon={MapPin} title="Map" count={dayPhotos.placed.length}>
            <MapViewControls
              onReset={() => {
                if (map.current) showAllPhotos(map.current, mapPhotos.bounds);
              }}
            >
              <MapDisplayOptions display={display} onChange={changeDisplay} />
              <MapFilterToggle count={setFilterCount(search)}>
                <MapDayFilter
                  days={daysInView(mapPhotos.placed, view)}
                  range={search}
                  onChange={setDays}
                />
                <PhotoFilterControls photos={placedPhotos}>
                  <ViewInGridButton
                    filters={gridFiltersFor(dayPhotos.placed, view, parseFilters(search))}
                  />
                </PhotoFilterControls>
              </MapFilterToggle>
            </MapViewControls>
          </FloatingHeader>
          <Source
            // Grouping differently needs a new source, as MapLibre can't change it on one.
            key={display.grouping}
            id={SOURCE_ID}
            type="geojson"
            data={dayPhotos.geoJson}
            cluster
            clusterMaxZoom={17}
            // Photos group when they're closer than this many pixels: by default a little under a
            // marker's width, so groups split as soon as their markers would barely overlap.
            clusterRadius={display.grouping}
          >
            <Layer {...hiddenLayer} />
          </Source>
          {markers.map((marker) => (
            <MapMarkerView
              key={marker.key}
              marker={marker}
              display={display}
              onOpenPhoto={openPhoto}
              onOpenCluster={(open) => void openCluster(open)}
            />
          ))}
          {cluster && (
            <OpenClusterView
              cluster={cluster}
              phone={phone}
              onOpen={(photo) => openPhoto(photo, cluster.photos)}
              onClose={() => setCluster(null)}
            />
          )}
          {selected && <PhotoPopup photo={selected} onClose={() => setSelected(null)} />}
        </Map>
      </div>
      <PhotoLightbox photo={shown} photos={shownGroup} onShow={show} onClose={close} />
    </div>
  );
}

/** How the map fits a group's photos when it's clicked. */
const CLUSTER_FIT = { padding: FIT_PADDING, maxZoom: 18 };

/**
 * The bounds to fit to show a group's photos split apart, or null when fitting them wouldn't zoom
 * in noticeably, as they're all at one spot or the map is already as close as it goes.
 */
function zoomToFit(map: MapRef, clusterPhotos: PlacedPhoto[]): LngLatBounds | null {
  const bounds = boundsOf(clusterPhotos);
  if (!bounds) return null;
  return fitZoom(map, bounds) > map.getZoom() + 0.5 ? bounds : null;
}

/** How far in the map would zoom to fit the bounds, or 0 when they can't be fitted. */
function fitZoom(map: MapRef, bounds: LngLatBounds): number {
  return map.cameraForBounds(bounds, CLUSTER_FIT)?.zoom ?? 0;
}

/** Phones, where the open cluster's grid is a sheet along the bottom of the map. */
const PHONE_QUERY = "(max-width: 767px)";

/** How far from the middle the map puts a cluster that's opened, in pixels. */
function clusterOffset(phone: boolean): [number, number] {
  return phone ? [0, -120] : [0, 150];
}

/** The open cluster's grid: a popup above it, or on phones a sheet along the bottom. */
function OpenClusterView({
  cluster,
  phone,
  onOpen,
  onClose,
}: {
  cluster: OpenCluster;
  phone: boolean;
  onOpen: (photo: PlacedPhoto) => void;
  onClose: () => void;
}) {
  const grid = { cluster, onOpen };
  if (phone) return <ClusterSheet {...grid} onClose={onClose} />;
  return (
    <Popup
      longitude={cluster.longitude}
      latitude={cluster.latitude}
      anchor="bottom"
      offset={24}
      maxWidth="none"
      onClose={onClose}
      className={MAP_POPUP}
    >
      <ClusterGrid {...grid} className="w-[19rem] [&>div:first-child]:pr-5" />
    </Popup>
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
