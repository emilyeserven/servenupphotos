import { type CSSProperties, type ReactNode, useMemo } from "react";
import { MarkerPin, type PinPhoto } from "@/components/marker-pin";
import { WheelMinimap } from "@/components/wheel-minimap";
import { WheelZoomControls } from "@/components/wheel-zoom-controls";
import type { KeepInside, WheelPoint } from "@/lib/color-wheel";
import { pinMarkers } from "@/lib/pin-markers";
import {
  centerOn,
  MAX_ZOOM,
  useWheelZoom,
  type ViewportSize,
  type WheelView,
  zoomAt,
} from "@/lib/use-wheel-zoom";
import type { WheelMarker } from "@/lib/wheel-clusters";
import { useSize } from "@/lib/use-size";
import { cn } from "@/lib/utils";

/** The board's top fading in from transparent, as a mask. */
const TOP_FADE = "linear-gradient(to bottom, transparent, black 3rem)";

/** How much clicking a cluster zooms in on it. */
const CLUSTER_ZOOM = 2;

/** What a pin board draws its pins over, at every zoom, and on its mini map. */
export interface BoardLook {
  /** How wide pins are, in pixels, on a canvas of size pixels holding count photos. */
  pinSize: (canvas: ViewportSize, count: number) => number;
  /** Keeps a pin inside a canvas of size pixels, such as inside the wheel. */
  keep: (canvas: ViewportSize) => KeepInside;
  /** What's under the pins, filling the canvas, drawn again on the mini map. */
  background: ReactNode;
  /** Classes for the board's frame, such as its rounding. */
  className: string;
  /** Classes for the mini map's frame: round for the wheel. */
  minimapClassName: string;
  /** What the button showing the whole board is called, such as "Show the whole wheel". */
  wholeLabel: string;
  /**
   * Whether the board's top always fades in from the page's background, as the Black & white
   * chart's does; otherwise it only does while zoomed in, so what's cut off doesn't end sharply.
   */
  fadeTop: boolean;
}

/**
 * The photos as pins at places (fractions of the board's width and height), like the Map page's,
 * for the color wheel and the Black & white chart. It fills its parent, which sets its size. Where three or more crowd together, they're one
 * cluster pin showing how many there are; clicking it zooms in on it. It zooms with its buttons,
 * a pinch, or ctrl + scrolling, and pans by dragging; zoomed in, a mini map shows where the view
 * is. Pins stay the same size as it zooms, so zooming in spreads crowded pins out and splits
 * clusters apart, and at the furthest zoom nothing is clustered.
 */
export function PinBoard<T extends PinPhoto>({
  photos,
  places,
  look,
  scale,
  onOpen,
}: {
  photos: T[];
  places: WheelPoint[];
  look: BoardLook;
  /** How much bigger than the look's size the pins are drawn, 1 for as it says. */
  scale: number;
  onOpen: (photo: T) => void;
}) {
  const [viewport, size] = useSize();
  const { view, setView, animateTo, layoutZoom } = useWheelZoom(viewport, size);
  // Pins are laid out for where an animated zoom is heading, so they don't regroup every frame;
  // as the canvas grows or shrinks they move with it.
  const canvas = useMemo(
    () => ({ width: size.width * layoutZoom, height: size.height * layoutZoom }),
    [size, layoutZoom],
  );
  const pinPx = Math.round(look.pinSize(canvas, photos.length) * scale);
  const markers = useMemo(
    () => pinMarkers(places, canvas, pinPx, layoutZoom < MAX_ZOOM, look.keep(canvas)),
    [places, canvas, pinPx, layoutZoom, look],
  );
  return (
    <div className="relative size-full">
      <div
        ref={viewport}
        className={cn(
          "relative size-full cursor-grab overflow-hidden select-none active:cursor-grabbing [&_img]:pointer-events-none",
          look.className,
        )}
        style={viewportStyle(view.zoom > 1, look.fadeTop)}
      >
        <div className="absolute" style={{ ...canvasStyle(view, size), ...aspectVar(size) }}>
          {look.background}
          {markers.map((marker) => (
            <MarkerPin
              key={photos[marker.members[0]!]!.id}
              marker={marker}
              photos={photos}
              size={pinPx}
              onOpen={onOpen}
              onZoomIn={() => animateTo(zoomInOn(view, marker))}
            />
          ))}
        </div>
      </div>
      <WheelZoomControls
        view={view}
        onChange={animateTo}
        wholeLabel={look.wholeLabel}
        className="absolute right-3 bottom-3"
      />
      {view.zoom > 1 && (
        <WheelMinimap
          view={view}
          points={places}
          aspect={aspectOf(size)}
          background={look.background}
          onChange={setView}
          className={cn("fixed bottom-4 left-4 z-20", look.minimapClassName)}
        />
      )}
    </div>
  );
}

/**
 * The viewport's touch handling and top fade: zoomed in, a drag pans it rather than the page, and
 * its top fades in so what's cut off doesn't end sharply.
 */
function viewportStyle(zoomed: boolean, fadeTop: boolean): CSSProperties {
  return {
    touchAction: zoomed ? "none" : "pan-y",
    maskImage: zoomed || fadeTop ? TOP_FADE : undefined,
  };
}

/** Where the zoomed canvas sits in the viewport, size pixels, so view's middle is in its middle. */
function canvasStyle({ zoom, x, y }: WheelView, { width, height }: ViewportSize) {
  const w = width * zoom;
  const h = height * zoom;
  return { width: w, height: h, left: width / 2 - x * w, top: height / 2 - y * h };
}

/** The board's height over its width. */
function aspectOf({ width, height }: ViewportSize): number {
  return height / Math.max(1, width);
}

/**
 * The board's height over its width as `--board-aspect`, for a background drawn square and
 * squashed or stretched to fit, such as the color wheel's.
 */
function aspectVar(size: ViewportSize): CSSProperties {
  return { "--board-aspect": aspectOf(size) } as CSSProperties;
}

/** The view zoomed in on a cluster, with it in the middle. */
function zoomInOn(view: WheelView, { at }: WheelMarker): WheelView {
  return centerOn(zoomAt(view, CLUSTER_ZOOM, at), at);
}
