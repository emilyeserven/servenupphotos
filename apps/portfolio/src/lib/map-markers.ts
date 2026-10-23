import type { MapRef } from "@vis.gl/react-maplibre";
import type { GeoJSONFeature, GeoJSONSource } from "maplibre-gl";
import { atOneSpot, FAN_MAX_PHOTOS, FAN_MIN_ZOOM, type FanOffset, fanOffsets } from "@/lib/map-fan";
import { type PhotoPoint, type PlacedPhoto, placedById } from "@/lib/map-photos";

/** The ID of the map's source of photos, which MapLibre groups into clusters. */
export const SOURCE_ID = "photos";

/** A marker on the map: one photo, or a cluster of photos too close together to tell apart. */
export type MapMarker =
  | {
      kind: "photo";
      key: string;
      photo: PlacedPhoto;
      /** How far it's moved from its spot, to sit around the other photos there. */
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

/** The markers for the clusters and photos in view, once each, as tiles can repeat them. */
function sourceMarkers(map: MapRef): MapMarker[] {
  const markers = new globalThis.Map<string, MapMarker>();
  for (const feature of map.querySourceFeatures(SOURCE_ID)) {
    const marker = markerOf(feature);
    if (marker) markers.set(marker.key, marker);
  }
  return [...markers.values()];
}

function photoMarker(photo: PlacedPhoto): MapMarker {
  return { kind: "photo", key: `photo-${photo.id}`, photo };
}

/**
 * A cluster's photos as markers of their own when it's a few photos at one spot, such as photos
 * placed at one of their places, as zooming in never splits those apart. Otherwise the marker.
 */
async function splitAtOneSpot(map: MapRef, marker: MapMarker): Promise<MapMarker[]> {
  if (marker.kind !== "cluster" || marker.count > FAN_MAX_PHOTOS) return [marker];
  const clusterPhotos = await photosInCluster(map, marker.clusterId);
  return atOneSpot(clusterPhotos) ? clusterPhotos.map(photoMarker) : [marker];
}

/** Moves photo markers at the same spot apart, into a circle around it. */
function fanOut(markers: MapMarker[]): MapMarker[] {
  const offsets = fanOffsets(
    markers.flatMap((marker) => (marker.kind === "photo" ? marker.photo : [])),
  );
  return markers.map((marker) =>
    marker.kind === "photo" ? { ...marker, offset: offsets.get(marker.photo.id) } : marker,
  );
}

/**
 * The markers in view. From FAN_MIN_ZOOM in, a few photos at one spot are spread around it so
 * each can be seen.
 */
export async function markersInView(map: MapRef): Promise<MapMarker[]> {
  const markers = sourceMarkers(map);
  if (map.getZoom() < FAN_MIN_ZOOM) return markers;
  const split = await Promise.all(markers.map((marker) => splitAtOneSpot(map, marker)));
  return fanOut(split.flat());
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
