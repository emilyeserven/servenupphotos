import { useMemo } from "react";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { WheelClusterPin } from "@/components/wheel-cluster-pin";
import { WheelMinimap } from "@/components/wheel-minimap";
import { WheelZoomControls } from "@/components/wheel-zoom-controls";
import { type VividMeasure, vividnessOf } from "@/lib/color-sort";
import {
  hueAngle,
  spreadPins,
  WHEEL_BACKGROUND,
  type WheelPoint,
  wheelPoint,
} from "@/lib/color-wheel";
import type { ColorShare } from "@/lib/photo-colors";
import type { PhotoImage } from "@/lib/photos";
import { centerOn, MAX_ZOOM, useWheelZoom, type WheelView, zoomAt } from "@/lib/use-wheel-zoom";
import { clusterPlaces, type WheelMarker } from "@/lib/wheel-clusters";
import { useWidth } from "@/lib/use-width";

/** A photo the wheel can place: its thumbnail, colors and vividness. */
interface WheelPhoto {
  id: number;
  title: string;
  image: PhotoImage;
  palette: ColorShare[];
  vividness: number;
  peakVividness: number;
}

/**
 * The least vividness the wheel's edge stands for, so a page of only muted photos isn't stretched
 * out to the edge as though they were vivid.
 */
const MIN_EDGE = 20;

/** A pin's widest and narrowest in pixels, and the gap kept between pins when they're spread apart. */
const MAX_PIN_PX = 32;
const MIN_PIN_PX = 14;
const PIN_GAP_PX = 3;

/** How much of the wheel the pins may cover between them before they're made smaller to fit. */
const PIN_COVER = 0.5;

/** How close, in pin widths, photos' places are for them to be clustered together. */
const CLUSTER_SPAN = 1.5;

/** How much clicking a cluster zooms in on it. */
const CLUSTER_ZOOM = 2;

/**
 * The photos as pins on a color wheel, like the Map page's: around it by hue, red at the top, and
 * out from the gray middle by vividness (by measure), the most vivid at the edge. Clicking a pin
 * opens the photo. It zooms with its buttons, a pinch, or ctrl + scrolling, and pans by dragging;
 * zoomed in, a mini map shows where the view is. Pins stay the same size as it zooms, so zooming
 * in spreads crowded pins out. Where three or more photos' places crowd together, they're one
 * cluster pin showing how many there are, which splits apart as the wheel zooms in; clicking it
 * zooms in on it.
 */
export function ColorWheel<T extends WheelPhoto>({
  photos,
  measure,
  onOpen,
}: {
  photos: T[];
  measure: VividMeasure;
  onOpen: (photo: T) => void;
}) {
  const mostVivid = Math.max(MIN_EDGE, ...photos.map((photo) => vividnessOf(photo, measure)));
  const [viewport, width] = useWidth();
  const { view, setView } = useWheelZoom(viewport, width);
  const wheelPx = width * view.zoom;
  const pinPx = pinSize(wheelPx, photos.length);
  const places = useMemo(
    () =>
      photos.map((photo) =>
        wheelPoint(hueAngle(photo.palette), vividnessOf(photo, measure), mostVivid),
      ),
    [photos, measure, mostVivid],
  );
  const markers = useMemo(
    () => spreadMarkers(places, view.zoom, wheelPx, pinPx),
    [places, view.zoom, wheelPx, pinPx],
  );
  return (
    <figure className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3">
      <div className="relative w-full">
        <div
          ref={viewport}
          className="relative aspect-square w-full cursor-grab overflow-hidden rounded-xl select-none active:cursor-grabbing [&_img]:pointer-events-none"
          style={{ touchAction: view.zoom > 1 ? "none" : "pan-y" }}
        >
          <div className="absolute" style={canvasStyle(view, width)}>
            <div
              aria-hidden
              className="absolute inset-[3%] rounded-full opacity-70 shadow-inner"
              style={{ background: WHEEL_BACKGROUND }}
            />
            {markers.map((marker) => (
              <WheelMarkerPin
                key={photos[marker.members[0]!]!.id}
                marker={marker}
                photos={photos}
                size={pinPx}
                onOpen={onOpen}
                onZoomIn={() => setView(zoomInOn(view, marker))}
              />
            ))}
          </div>
        </div>
        <WheelZoomControls view={view} onChange={setView} className="absolute top-2 right-2" />
        {view.zoom > 1 && (
          <WheelMinimap
            view={view}
            points={places}
            onChange={setView}
            className="absolute bottom-2 left-2"
          />
        )}
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">
        Around the wheel by color, red at the top, pulled toward each photo&apos;s second color. Out
        from the middle by {measure === "peak" ? "peak vividness" : "vividness"}: the most vivid
        photo here, at {mostVivid}, is at the edge. Pins that would overlap are moved apart, and
        crowded ones are clustered until you zoom in. Black and white photos are on their own
        spectrum instead. Zoom with the buttons, a pinch or ctrl + scroll, and drag to look around.
      </figcaption>
    </figure>
  );
}

/**
 * The photos' places as markers for a wheel wheelPx wide at zoom, with pins pinPx wide: clustered
 * where they crowd together (not at the furthest zoom, so every photo can be reached), then spread
 * apart so the pins don't overlap.
 */
function spreadMarkers(
  places: WheelPoint[],
  zoom: number,
  wheelPx: number,
  pinPx: number,
): WheelMarker[] {
  if (wheelPx <= 0) return places.map((at, i) => ({ members: [i], at }));
  const radius = zoom >= MAX_ZOOM ? 0 : (pinPx * CLUSTER_SPAN) / wheelPx;
  const markers = clusterPlaces(places, radius);
  const spread = spreadPins(
    markers.map((marker) => marker.at),
    (pinPx + PIN_GAP_PX) / wheelPx,
  );
  return markers.map((marker, i) => ({ ...marker, at: spread[i]! }));
}

/** The view zoomed in on a cluster, with it in the middle. */
function zoomInOn(view: WheelView, { at }: WheelMarker): WheelView {
  return centerOn(zoomAt(view, CLUSTER_ZOOM, at), at);
}

/** A marker's pin: a cluster's, or its one photo's. */
function WheelMarkerPin<T extends WheelPhoto>({
  marker,
  photos,
  size,
  onOpen,
  onZoomIn,
}: {
  marker: WheelMarker;
  photos: T[];
  size: number;
  onOpen: (photo: T) => void;
  onZoomIn: () => void;
}) {
  const first = photos[marker.members[0]!]!;
  if (marker.members.length > 1) {
    return (
      <WheelClusterPin
        image={first.image}
        count={marker.members.length}
        at={marker.at}
        size={size}
        onZoomIn={onZoomIn}
      />
    );
  }
  return <WheelPin photo={first} at={marker.at} size={size} onOpen={() => onOpen(first)} />;
}

/** Where the zoomed wheel sits in the viewport, width pixels square, so view's middle is in its middle. */
function canvasStyle({ zoom, x, y }: WheelView, width: number) {
  const size = width * zoom;
  return { width: size, height: size, left: width / 2 - x * size, top: width / 2 - y * size };
}

/**
 * How wide each pin is, in pixels, for count pins on a wheel width wide: as big as they can be
 * while covering only PIN_COVER of the wheel between them, so a phone's smaller wheel still has
 * room to spread them out.
 */
function pinSize(width: number, count: number): number {
  const wheelArea = Math.PI * (0.47 * width) ** 2;
  const fits = Math.sqrt((wheelArea * PIN_COVER) / Math.max(count, 1)) - PIN_GAP_PX;
  return Math.round(Math.min(MAX_PIN_PX, Math.max(MIN_PIN_PX, fits)));
}

const PIN_CLASS =
  "absolute block -translate-x-1/2 -translate-y-1/2 cursor-zoom-in overflow-hidden rounded-md bg-muted shadow-md shadow-black/30 ring-2 ring-white outline-none transition-transform hover:z-10 hover:scale-150 focus-visible:z-10 focus-visible:scale-150 focus-visible:ring-sky-500";

/** A photo's pin: its square thumbnail at its place on the wheel. */
function WheelPin({
  photo,
  at,
  size,
  onOpen,
}: {
  photo: WheelPhoto;
  at: WheelPoint;
  /** Its width in pixels. */
  size: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={onOpen}
      className={PIN_CLASS}
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%`, width: size, height: size }}
    >
      <PhotoThumbnail image={photo.image} />
    </button>
  );
}
