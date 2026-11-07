import type { LngLatBounds } from "maplibre-gl";
import type { MapMarker } from "@/lib/map-markers";
import type { PlacedPhoto } from "@/lib/map-photos";
import type { TripLinesMap, TripMapFeature } from "@/lib/trip-lines-map";

/** What the map's key lists, as only what the map is drawing now. */
export interface LegendItems {
  /** Whether a photo's own pin, with its thumbnail and an exact spot, is in view. */
  photo: boolean;
  /** Whether a group's marker is in view. */
  group: boolean;
  /** Whether a photo without resized versions yet is in view, as a small light-blue dot. */
  noImage: boolean;
  /** Whether a photo placed by its area rather than an exact spot is in view, with a faded edge. */
  approximate: boolean;
  /** Whether a day's walk is drawn. */
  walk: boolean;
  /** The colors of the transit lines a hop rode, at most a few, in the order first drawn. */
  rides: string[];
  /** Whether a hop with no transit line picked is drawn, dashed. */
  hop: boolean;
  /** Whether a place visited is drawn, as an amber dot. */
  visit: boolean;
  /** Whether an area is shaded: a trip line's area, or the place picked or pointed at in Places. */
  area: boolean;
}

/** How many transit line colors the key's sample shows. */
const MAX_RIDES = 4;

function isLine(feature: TripMapFeature): boolean {
  return feature.properties.feature === undefined;
}

function isWalk(feature: TripMapFeature): boolean {
  return isLine(feature) && feature.properties.mode === "walk";
}

/** A hop's transit line color, or undefined for a walk, a hop without one, or no line at all. */
function rideColor(feature: TripMapFeature): string | undefined {
  return isLine(feature) && !isWalk(feature) ? feature.properties.colour : undefined;
}

function isHop(feature: TripMapFeature): boolean {
  return isLine(feature) && !isWalk(feature) && feature.properties.colour === undefined;
}

/** The distinct transit line colors of the hops, up to MAX_RIDES. */
function rideColors(features: TripMapFeature[]): string[] {
  const colors = new Set(features.map(rideColor).filter((color) => color !== undefined));
  return [...colors].slice(0, MAX_RIDES);
}

/** Every [longitude, latitude] pair in a feature's coordinates, however deeply they're nested. */
function pointsOf(coordinates: unknown): [number, number][] {
  if (!Array.isArray(coordinates)) return [];
  if (typeof coordinates[0] === "number") return [coordinates as [number, number]];
  return coordinates.flatMap(pointsOf);
}

/** Whether the box around the points overlaps the view. */
function boxInView(points: [number, number][], view: LngLatBounds): boolean {
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  const west = Math.min(...lngs) <= view.getEast() && Math.max(...lngs) >= view.getWest();
  return west && Math.min(...lats) <= view.getNorth() && Math.max(...lats) >= view.getSouth();
}

/** Whether a feature reaches into the view, which counts every feature before the map is drawn. */
function featureInView(feature: TripMapFeature, view: LngLatBounds | null): boolean {
  const points = pointsOf(feature.geometry.coordinates);
  return view === null || (points.length > 0 && boxInView(points, view));
}

/** Which of the trip lines' kinds are in view, or none while they're off or not loaded. */
function tripItems(trips: TripLinesMap | undefined, view: LngLatBounds | null) {
  const features = (trips?.features ?? []).filter((f) => featureInView(f, view));
  const has = (kind: "visit" | "fence") => features.some((f) => f.properties.feature === kind);
  return {
    walk: features.some(isWalk),
    rides: rideColors(features),
    hop: features.some(isHop),
    visit: has("visit"),
    fence: has("fence"),
  };
}

/** The photos with their own pins in view, rather than in a group. */
function pinnedPhotos(markers: MapMarker[]): PlacedPhoto[] {
  return markers.flatMap((marker) => (marker.kind === "photo" ? [marker.photo] : []));
}

/** Which kinds of photo pin are in view. */
function pinItems(markers: MapMarker[]) {
  const pinned = pinnedPhotos(markers);
  return {
    photo: pinned.some((photo) => photo.image !== null && !photo.approximatePosition),
    group: markers.some((marker) => marker.kind === "cluster"),
    noImage: pinned.some((photo) => photo.image === null),
    approximate: pinned.some((photo) => photo.image !== null && photo.approximatePosition),
  };
}

/**
 * What the key lists: the markers in view, the trip lines under them that reach into the view, and
 * whether a place's area is shaded.
 */
export function legendItems(
  markers: MapMarker[],
  trips: TripLinesMap | undefined,
  view: LngLatBounds | null,
  placeArea: boolean,
): LegendItems {
  const { fence, ...lines } = tripItems(trips, view);
  return { ...pinItems(markers), ...lines, area: fence || placeArea };
}
