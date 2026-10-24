import { useEffect, useMemo, useRef, useState } from "react";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
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
import { useWheelZoom, type WheelView } from "@/lib/use-wheel-zoom";

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

/**
 * The photos as pins on a color wheel, like the Map page's: around it by hue, red at the top, and
 * out from the gray middle by vividness (by measure), the most vivid at the edge. Clicking a pin
 * opens the photo. It zooms with its buttons, a pinch, or ctrl + scrolling, and pans by dragging;
 * zoomed in, a mini map shows where the view is. Pins stay the same size as it zooms, so zooming
 * in spreads crowded pins out.
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
  const points = useMemo(() => {
    const places = photos.map((photo) =>
      wheelPoint(hueAngle(photo.palette), vividnessOf(photo, measure), mostVivid),
    );
    return wheelPx > 0 ? spreadPins(places, (pinPx + PIN_GAP_PX) / wheelPx) : places;
  }, [photos, measure, mostVivid, wheelPx, pinPx]);
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
            {photos.map((photo, i) => (
              <WheelPin
                key={photo.id}
                photo={photo}
                at={points[i]!}
                size={pinPx}
                onOpen={() => onOpen(photo)}
              />
            ))}
          </div>
        </div>
        <WheelZoomControls view={view} onChange={setView} className="absolute top-2 right-2" />
        {view.zoom > 1 && (
          <WheelMinimap
            view={view}
            points={points}
            onChange={setView}
            className="absolute bottom-2 left-2"
          />
        )}
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">
        Around the wheel by color, red at the top, pulled toward each photo&apos;s second color. Out
        from the middle by {measure === "peak" ? "peak vividness" : "vividness"}: the most vivid
        photo here, at {mostVivid}, is at the edge. Pins that would overlap are moved apart. Zoom
        with the buttons, a pinch or ctrl + scroll, and drag to look around.
      </figcaption>
    </figure>
  );
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

/** A ref for an element and its width in pixels, kept up to date as it resizes; 0 until it's measured. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
