import type { MapRef } from "@vis.gl/react-maplibre";
import type { GeoJSONFeature, GeoJSONSource } from "maplibre-gl";
import {
  FAN_MIN_ZOOM,
  fanLimit,
  type FanOffset,
  fanOffsets,
  type ScreenPoint,
} from "@/lib/map-fan";
import { type PhotoPoint, type PlacedPhoto, placedById } from "@/lib/map-photos";

/** The ID of the map's source of photos, which MapLibre groups into clusters. */
export const SOURCE_ID = "photos";

/** A marker on the map: one photo, or a cluster of photos too close together to tell apart. */
export type MapMarker =
  | {
      kind: "photo";
      key: string;
      photo: PlacedPhoto;
      /** How far it's moved from its spot, so it doesn't cover the photos near it. */
      offset?: FanOffset;
    }
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
    const photo = placedById.get(properties.id);
    return photo ? photoMarker(photo) : null;
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

/** Each marker once, by its key, as tiles can repeat them. */
function once(markers: MapMarker[]): MapMarker[] {
  return [...new globalThis.Map(markers.map((marker) => [marker.key, marker])).values()];
}

/** The markers for the clusters and photos in view, once each. */
function sourceMarkers(map: MapRef): MapMarker[] {
  return once(map.querySourceFeatures(SOURCE_ID).flatMap((feature) => markerOf(feature) ?? []));
}

function photoMarker(photo: PlacedPhoto): MapMarker {
  return { kind: "photo", key: `photo-${photo.id}`, photo };
}

/** A small cluster's photos as markers of their own, or a bigger cluster's marker as it is. */
async function splitSmall(map: MapRef, marker: MapMarker, spacing: number): Promise<MapMarker[]> {
  if (marker.kind !== "cluster" || marker.count > fanLimit(map.getZoom(), spacing)) return [marker];
  return (await photosInCluster(map, marker.clusterId)).map(photoMarker);
}

/** Where a spot on the map is on the screen. */
function screenPoint(map: MapRef, longitude: number, latitude: number): ScreenPoint {
  const { x, y } = map.project([longitude, latitude]);
  return [x, y];
}

/**
 * Moves photo markers apart so none overlap one another or a group's marker, keeping them
 * `spacing` pixels apart.
 */
function fanOut(map: MapRef, markers: MapMarker[], spacing: number): MapMarker[] {
  const groups = markers.flatMap((marker) =>
    marker.kind === "cluster" ? [screenPoint(map, marker.longitude, marker.latitude)] : [],
  );
  const photos = markers.flatMap((marker) =>
    marker.kind === "photo"
      ? [
          {
            photo: marker.photo,
            at: screenPoint(map, marker.photo.longitude, marker.photo.latitude),
          },
        ]
      : [],
  );
  const offsets = fanOffsets(photos, groups, spacing);
  return markers.map((marker) =>
    marker.kind === "photo" ? { ...marker, offset: offsets.get(marker.photo.id) } : marker,
  );
}

/**
 * The markers in view. From FAN_MIN_ZOOM in, small groups (see fanLimit) are split into photos of
 * their own, and photos are moved apart just enough that each can be seen, `spacing` pixels apart.
 */
export async function markersInView(map: MapRef, spacing: number): Promise<MapMarker[]> {
  const markers = sourceMarkers(map);
  if (map.getZoom() < FAN_MIN_ZOOM) return markers;
  const split = await Promise.all(markers.map((marker) => splitSmall(map, marker, spacing)));
  // While zooming, tiles from the old zoom and the new one can both be loaded, so a cluster split
  // here can repeat photos another tile already has on their own.
  return fanOut(map, once(split.flat()), spacing);
}

/** The photos in a cluster, oldest first. */
export async function photosInCluster(map: MapRef, clusterId: number): Promise<PlacedPhoto[]> {
  const source = map.getSource<GeoJSONSource>(SOURCE_ID);
  if (!source) return [];
  const leaves = await source.getClusterLeaves(clusterId, Infinity, 0);
  return leaves
    .flatMap((leaf) => placedById.get(leaf.properties?.id) ?? [])
    .toSorted((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
}
