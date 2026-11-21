import type { MapRef } from "@vis.gl/react-maplibre";
import type { GeoJSONFeature, GeoJSONSource } from "maplibre-gl";
import { groupingSources } from "@/lib/map-country-groups";
import {
  FAN_MIN_ZOOM,
  fanLimit,
  type FanOffset,
  fanOffsets,
  fanSpacing,
  type MarkerOnScreen,
  type ScreenPoint,
} from "@/lib/map-fan";
import { type MapSet, type PhotoPoint, type PlacedPhoto, placedById } from "@/lib/map-photos";

/**
 * A marker on the map: one photo, a cluster of photos too close together to tell apart, or a Photo
 * Set, which stays one marker at every zoom.
 */
export type MapMarker =
  | {
      kind: "photo";
      key: string;
      photo: PlacedPhoto;
      /** How far it's moved from its spot, so it doesn't cover the markers near it. */
      offset?: FanOffset;
    }
  | {
      kind: "cluster";
      key: string;
      /** The ID of the map source that grouped it, which its cluster ID belongs to. */
      source: string;
      clusterId: number;
      count: number;
      longitude: number;
      latitude: number;
      /** How far it's moved from its spot, so it doesn't cover the markers near it. */
      offset?: FanOffset;
    }
  | {
      kind: "set";
      key: string;
      set: MapSet;
      /** How far it's moved from its spot, so it doesn't cover the markers near it. */
      offset?: FanOffset;
    };

/** The marker for one of a source's features, or null for a photo it doesn't know. */
function markerOf(feature: GeoJSONFeature, source: string): MapMarker | null {
  const properties = feature.properties ?? {};
  if (typeof properties.cluster_id !== "number") {
    const photo = placedById.get(properties.id);
    return photo ? photoMarker(photo) : null;
  }
  const [longitude, latitude] = (feature.geometry as PhotoPoint).coordinates;
  return {
    kind: "cluster",
    key: `cluster-${source}-${properties.cluster_id}`,
    source,
    clusterId: properties.cluster_id,
    count: properties.point_count,
    longitude,
    latitude,
  };
}

/** Each marker once, by its key, as tiles can repeat them. */
function once(markers: MapMarker[]): MapMarker[] {
  return [...new globalThis.Map(markers.map((marker) => [marker.key, marker])).values()];
}

/**
 * The markers for the clusters and photos in view, once each, from the sources that group them at
 * this zoom (see groupingSources), given the IDs of the countries' sources.
 */
function sourceMarkers(map: MapRef, countrySources: string[]): MapMarker[] {
  return once(
    groupingSources(map.getZoom(), countrySources).flatMap((source) =>
      map.querySourceFeatures(source).flatMap((feature) => markerOf(feature, source) ?? []),
    ),
  );
}

function photoMarker(photo: PlacedPhoto): MapMarker {
  return { kind: "photo", key: `photo-${photo.id}`, photo };
}

/** A small cluster's photos as markers of their own, or a bigger cluster's marker as it is. */
async function splitSmall(map: MapRef, marker: MapMarker, pin: number): Promise<MapMarker[]> {
  if (marker.kind !== "cluster" || marker.count > fanLimit(map.getZoom(), pin)) return [marker];
  return (await photosInCluster(map, marker)).map(photoMarker);
}

/** Where a spot on the map is on the screen. */
function screenPoint(map: MapRef, longitude: number, latitude: number): ScreenPoint {
  const { x, y } = map.project([longitude, latitude]);
  return [x, y];
}

/** A number made from the text, the same every time, to seed where a set's marker is moved to. */
function seedOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

/** A marker's spot on the screen, and the number that seeds where it's moved to. */
function onScreen(map: MapRef, marker: MapMarker): MarkerOnScreen {
  if (marker.kind === "set") {
    const { set } = marker;
    return {
      key: marker.key,
      seed: seedOf(set.id),
      at: screenPoint(map, set.longitude, set.latitude),
    };
  }
  if (marker.kind === "cluster") {
    const at = screenPoint(map, marker.longitude, marker.latitude);
    return { key: marker.key, seed: marker.clusterId, at };
  }
  const { photo } = marker;
  return { key: marker.key, seed: photo.id, at: screenPoint(map, photo.longitude, photo.latitude) };
}

/**
 * Which of two markers keeps its spot first: groups before photos, bigger groups first, and the
 * older of two photos, so the markers standing for more photos, and the oldest photos, move least.
 */
function placedFirst(a: MapMarker, b: MapMarker): number {
  return weightOf(b) - weightOf(a) || takenOf(a) - takenOf(b);
}

/** How many photos a marker stands for, with groups and sets always ahead of a photo on its own. */
function weightOf(marker: MapMarker): number {
  if (marker.kind === "set") return 1 + marker.set.photos.length;
  return marker.kind === "cluster" ? 1 + marker.count : 1;
}

/** When a photo marker's photo was taken, in milliseconds; 0 for a group. */
function takenOf(marker: MapMarker): number {
  return marker.kind === "photo" ? marker.photo.takenAt.getTime() : 0;
}

/**
 * Moves the markers apart, groups included, so none covers more than the zoom allows of another
 * (see fanSpacing) for pins `pin` pixels wide.
 */
function fanOut(map: MapRef, markers: MapMarker[], pin: number): MapMarker[] {
  const order = markers.toSorted(placedFirst).map((marker) => onScreen(map, marker));
  const offsets = fanOffsets(order, fanSpacing(map.getZoom(), pin));
  return markers.map((marker) => ({ ...marker, offset: offsets.get(marker.key) }));
}

/** The markers of the Photo Sets whose spot is in view. */
function setMarkers(map: MapRef, sets: MapSet[]): MapMarker[] {
  const bounds = map.getBounds();
  return sets
    .filter((set) => bounds.contains([set.longitude, set.latitude]))
    .map((set) => ({ kind: "set", key: `set-${set.id}`, set }));
}

/**
 * The markers in view, for pins `pin` pixels wide, with one for each of the Photo Sets in view.
 * Zoomed out below COUNTRY_MAX_ZOOM, groups come from the countries' sources (`countrySources`, their
 * IDs), so none mixes photos from two countries.
 * From FAN_MIN_ZOOM in, small groups (see fanLimit) are split into photos of their own; sets never
 * are. At every zoom, markers are moved apart just enough that none is more than half covered, and
 * from FAN_MIN_ZOOM in that none overlap.
 */
export async function markersInView(
  map: MapRef,
  pin: number,
  sets: MapSet[],
  countrySources: string[],
): Promise<MapMarker[]> {
  const markers = [...setMarkers(map, sets), ...sourceMarkers(map, countrySources)];
  if (map.getZoom() < FAN_MIN_ZOOM) return fanOut(map, markers, pin);
  const split = await Promise.all(markers.map((marker) => splitSmall(map, marker, pin)));
  // While zooming, tiles from the old zoom and the new one can both be loaded, so a cluster split
  // here can repeat photos another tile already has on their own.
  return fanOut(map, once(split.flat()), pin);
}

/** The photos in a cluster, from the source that grouped it, oldest first. */
export async function photosInCluster(
  map: MapRef,
  { source: sourceId, clusterId }: { source: string; clusterId: number },
): Promise<PlacedPhoto[]> {
  const source = map.getSource<GeoJSONSource>(sourceId);
  if (!source) return [];
  const leaves = await source.getClusterLeaves(clusterId, Infinity, 0);
  return leaves
    .flatMap((leaf) => placedById.get(leaf.properties?.id) ?? [])
    .toSorted((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
}
