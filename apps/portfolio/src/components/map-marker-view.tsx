import { Marker, useMap } from "@vis.gl/react-maplibre";
import { type CSSProperties, type MouseEvent, useEffect, useState } from "react";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { type GroupPhotos, type MapDisplay, PIN_PIXELS } from "@/lib/map-display";
import { type MapMarker, photosInCluster } from "@/lib/map-markers";
import type { PlacedPhoto } from "@/lib/map-photos";
import { useTurn } from "@/lib/use-turn";
import { cn } from "@/lib/utils";

// Clicks on markers and in popups would otherwise reach the map too, which closes the popups.
function stopAtMarker(event: MouseEvent) {
  event.stopPropagation();
}

/** A marker for a group of photos, as the map reads it from its source. */
export type ClusterMarkerData = Extract<MapMarker, { kind: "cluster" }>;

/** A marker's width and height, in the size the display options pick. */
function pinStyle(display: MapDisplay): CSSProperties {
  const size = PIN_PIXELS[display.pinSize];
  return { width: size, height: size };
}

/** A marker on the map, a photo's or a group's, drawn as the display options say. */
export function MapMarkerView({
  marker,
  display,
  onOpenPhoto,
  onOpenCluster,
}: {
  marker: MapMarker;
  display: MapDisplay;
  onOpenPhoto: (photo: PlacedPhoto) => void;
  onOpenCluster: (marker: ClusterMarkerData) => void;
}) {
  if (marker.kind === "cluster") {
    return (
      <Marker longitude={marker.longitude} latitude={marker.latitude} offset={marker.offset}>
        <ClusterMarker
          clusterId={marker.clusterId}
          count={marker.count}
          display={display}
          onOpen={() => onOpenCluster(marker)}
        />
      </Marker>
    );
  }
  const { photo } = marker;
  return (
    <Marker longitude={photo.longitude} latitude={photo.latitude} offset={marker.offset}>
      <PhotoMarker photo={photo} display={display} onOpen={() => onOpenPhoto(photo)} />
    </Marker>
  );
}

const MARKER_RING =
  "outline-none ring-2 ring-white shadow-md shadow-black/30 transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:ring-sky-500";

/** A photo marker's size and classes: the pin size for a thumbnail, or a small dot without one. */
function photoMarkerLook(photo: PlacedPhoto, display: MapDisplay) {
  return {
    style: photo.image ? pinStyle(display) : undefined,
    className: cn(
      "block cursor-zoom-in overflow-hidden rounded-md bg-muted",
      !photo.image && "size-3.5 cursor-pointer rounded-full bg-sky-300",
      MARKER_RING,
      // A softer border for a photo placed at one of its places, as that spot is only near it.
      photo.approximatePosition && "ring-white/40",
    ),
  };
}

/** A photo's marker: its square thumbnail, or a dot for a photo without an image yet. */
function PhotoMarker({
  photo,
  display,
  onOpen,
}: {
  photo: PlacedPhoto;
  display: MapDisplay;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={(event) => {
        stopAtMarker(event);
        onOpen();
      }}
      {...photoMarkerLook(photo, display)}
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

/** When the photo was added to the portfolio, with ones from before that was kept as the oldest. */
function addedTime(photo: PlacedPhoto): number {
  return photo.addedAt?.getTime() ?? -Infinity;
}

/** How a cluster's photos are put newest first, by when they were added or when they were taken. */
const NEWEST_FIRST: Record<GroupPhotos, (a: PlacedPhoto, b: PlacedPhoto) => number> = {
  added: (a, b) => addedTime(b) - addedTime(a) || b.takenAt.getTime() - a.takenAt.getTime(),
  taken: (a, b) => b.takenAt.getTime() - a.takenAt.getTime(),
};

/**
 * The newest thumbnails of a cluster, newest first by when they were added or taken as `order`
 * says, and whether all its photos are approximate.
 */
function clusterLook(clusterPhotos: PlacedPhoto[], order: GroupPhotos): ClusterLook {
  const previews = clusterPhotos
    .toSorted(NEWEST_FIRST[order])
    .flatMap(({ image }) => (image ? [image.thumbnail || image.small] : []))
    .slice(0, CLUSTER_PREVIEWS);
  return { previews, approximate: clusterPhotos.every((photo) => photo.approximatePosition) };
}

/** How a cluster's marker looks, once its photos have been read from the map. */
function useClusterLook(clusterId: number, order: GroupPhotos): ClusterLook {
  const { current: map } = useMap();
  const [look, setLook] = useState<ClusterLook>({ previews: [], approximate: false });
  useEffect(() => {
    if (!map) return;
    let current = true;
    void photosInCluster(map, clusterId).then((clusterPhotos) => {
      if (current) setLook(clusterLook(clusterPhotos, order));
    });
    return () => {
      current = false;
    };
  }, [map, clusterId, order]);
  return look;
}

/**
 * A cluster's marker: its newest photos fading in and out in turn, with how many photos it covers
 * over them. The display options can hide the count, and show the photos as they are rather than
 * darkened so the count stays readable; the count then sits in a dark badge of its own.
 */
function ClusterMarker({
  clusterId,
  count,
  display,
  onOpen,
}: {
  clusterId: number;
  count: number;
  display: MapDisplay;
  onOpen: () => void;
}) {
  const { previews, approximate } = useClusterLook(clusterId, display.groupPhotos);
  const { turn } = useTurn(previews.length, CLUSTER_PREVIEW_MS);
  return (
    <button
      type="button"
      title={`Show these ${count} photos`}
      aria-label={`Show these ${count} photos`}
      onClick={(event) => {
        stopAtMarker(event);
        onOpen();
      }}
      style={pinStyle(display)}
      className={clusterClass(display, previews.length > 0, approximate)}
    >
      <ClusterPreviews previews={previews} turn={turn} />
      <ClusterCount count={count} display={display} hasPreviews={previews.length > 0} />
    </button>
  );
}

/** A cluster marker's classes, for its pin size, whether it has photos and how sure its spot is. */
function clusterClass(display: MapDisplay, hasPreviews: boolean, approximate: boolean): string {
  return cn(
    "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-full bg-sky-300 font-semibold text-blue-950",
    display.pinSize === "small" ? "text-xs" : "text-sm",
    hasPreviews && "bg-neutral-900 text-white",
    MARKER_RING,
    approximate && "ring-white/40",
  );
}

/** A cluster's newest photos, stacked, with the one whose turn it is showing. */
function ClusterPreviews({ previews, turn }: { previews: string[]; turn: number }) {
  return previews.map((src, index) => (
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
  ));
}

/**
 * A group's count over its photos, darkened behind it, or in a dark badge of its own when the
 * display options show the photos as they are; nothing when they hide counts.
 */
function ClusterCount({
  count,
  display,
  hasPreviews,
}: {
  count: number;
  display: MapDisplay;
  hasPreviews: boolean;
}) {
  const dimmed = hasPreviews && display.dimGroups;
  return (
    <>
      <DimOverlay shown={dimmed} />
      <CountText count={count} shown={display.showCounts} badge={hasPreviews && !dimmed} />
    </>
  );
}

/** The dark layer over a group's photos that keeps its count readable, while `shown`. */
function DimOverlay({ shown }: { shown: boolean }) {
  return shown ? <span aria-hidden className="absolute inset-0 bg-black/60" /> : null;
}

/** The count itself while `shown`, in a dark badge when the photos behind it aren't darkened. */
function CountText({ count, shown, badge }: { count: number; shown: boolean; badge: boolean }) {
  if (!shown) return null;
  return (
    <span
      aria-hidden
      className={cn("relative", badge && "rounded-full bg-black/70 px-1.5 leading-5 tabular-nums")}
    >
      {count}
    </span>
  );
}
