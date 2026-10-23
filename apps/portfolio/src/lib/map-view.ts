import { useNavigate } from "@tanstack/react-router";
import type { MapRef } from "@vis.gl/react-maplibre";
import { type RefObject, useEffect, useRef } from "react";

/**
 * Where the map is looking, as the URL keeps it: its center and zoom, such as
 * `?lat=37.57&lng=126.98&zoom=12.5`. All three are left out until the map has moved.
 */
export interface MapViewSearch {
  lat?: number;
  lng?: number;
  zoom?: number;
}

/** How long the map waits after it stops moving before it puts where it is in the URL, in milliseconds. */
const SAVE_DELAY_MS = 500;

/** The value when it's a number from min to max, or undefined. */
function numberIn(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === "number" ? value : Number.NaN;
  return n >= min && n <= max ? n : undefined;
}

/** The map's center and zoom from the URL's search, leaving all three out unless each is valid. */
export function parseMapView(search: Record<string, unknown>): MapViewSearch {
  const lat = numberIn(search.lat, -90, 90);
  const lng = numberIn(search.lng, -180, 180);
  const zoom = numberIn(search.zoom, 0, 24);
  return lat === undefined || lng === undefined || zoom === undefined ? {} : { lat, lng, zoom };
}

/** Rounds n to the number of decimal places, so the URL stays short. */
function rounded(n: number, places: number): number {
  return Number(n.toFixed(places));
}

/** Where the map is now, rounded to about a meter and a hundredth of a zoom level. */
function viewOf(map: MapRef): Required<MapViewSearch> {
  const { lat, lng } = map.getCenter().wrap();
  return { lat: rounded(lat, 5), lng: rounded(lng, 5), zoom: rounded(map.getZoom(), 2) };
}

/**
 * Puts where the map is in the URL once it has stopped moving for SAVE_DELAY_MS, so a link opens
 * the map there. A run of moves, such as scrolling to zoom, saves once. It replaces the URL rather
 * than adding to the history.
 */
function useSaveMapView(): (map: MapRef) => void {
  const navigate = useNavigate();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (map) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const view = viewOf(map);
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, ...view }),
        replace: true,
      });
    }, SAVE_DELAY_MS);
  };
}

/** Whether the map is already looking where view says, as far as the URL rounds it. */
function isShowing(map: MapRef, view: MapViewSearch): boolean {
  const now = viewOf(map);
  return now.lat === view.lat && now.lng === view.lng && now.zoom === view.zoom;
}

/**
 * Moves the map when the URL's center and zoom change to somewhere it isn't looking, as when the
 * photo viewer's **View on map** is used on the Map itself. The map's own saves already match it,
 * so they don't move it.
 */
function useFollowMapView(map: RefObject<MapRef | null>, view: MapViewSearch) {
  const { lat, lng, zoom } = view;
  useEffect(() => {
    if (!map.current || zoom === undefined || isShowing(map.current, { lat, lng, zoom })) return;
    map.current.flyTo({ center: [lng as number, lat as number], zoom });
  }, [map, lat, lng, zoom]);
}

/**
 * Keeps the map and the URL's center and zoom together: the map follows the URL when it changes
 * (useFollowMapView), and the returned function saves where the map is (useSaveMapView).
 */
export function useMapViewInUrl(
  map: RefObject<MapRef | null>,
  view: MapViewSearch,
): (map: MapRef) => void {
  useFollowMapView(map, view);
  return useSaveMapView();
}
