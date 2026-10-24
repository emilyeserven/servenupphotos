import { type ReactNode, useMemo } from "react";
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
import { useWidth } from "@/lib/use-width";
import { cn } from "@/lib/utils";

/** How much clicking a cluster zooms in on it. */
const CLUSTER_ZOOM = 2;

/** What a pin board draws its pins over, at every zoom, and on its mini map. */
export interface BoardLook {
  /** The board's height for its width in pixels: the same for the wheel, less for the chart. */
  heightFor: (width: number) => number;
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
}

/**
 * The photos as pins at places (fractions of the board's width and height), like the Map page's,
 * for the color wheel and the Black & white chart. Where three or more crowd together, they're one
 * cluster pin showing how many there are; clicking it zooms in on it. It zooms with its buttons,
 * a pinch, or ctrl + scrolling, and pans by dragging; zoomed in, a mini map shows where the view
 * is. Pins stay the same size as it zooms, so zooming in spreads crowded pins out and splits
 * clusters apart, and at the furthest zoom nothing is clustered.
 */
export function PinBoard<T extends PinPhoto>({
  photos,
  places,
  look,
  onOpen,
}: {
  photos: T[];
  places: WheelPoint[];
  look: BoardLook;
  onOpen: (photo: T) => void;
}) {
  const [viewport, width] = useWidth();
  const size = useMemo(() => ({ width, height: look.heightFor(width) }), [width, look]);
  const { view, setView } = useWheelZoom(viewport, size);
  const canvas = useMemo(
    () => ({ width: size.width * view.zoom, height: size.height * view.zoom }),
    [size, view.zoom],
  );
  const pinPx = look.pinSize(canvas, photos.length);
  const markers = useMemo(
    () => pinMarkers(places, canvas, pinPx, view.zoom < MAX_ZOOM, look.keep(canvas)),
    [places, canvas, pinPx, view.zoom, look],
  );
  return (
    <div className="relative w-full">
      <div
        ref={viewport}
        className={cn(
          "relative w-full cursor-grab overflow-hidden select-none active:cursor-grabbing [&_img]:pointer-events-none",
          look.className,
        )}
        style={{ height: size.height, touchAction: view.zoom > 1 ? "none" : "pan-y" }}
      >
        <div className="absolute" style={canvasStyle(view, size)}>
          {look.background}
          {markers.map((marker) => (
            <MarkerPin
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
      <WheelZoomControls
        view={view}
        onChange={setView}
        wholeLabel={look.wholeLabel}
        className="absolute top-2 right-2"
      />
      {view.zoom > 1 && (
        <WheelMinimap
          view={view}
          points={places}
          aspect={size.height / Math.max(1, size.width)}
          background={look.background}
          onChange={setView}
          className={cn("absolute bottom-2 left-2", look.minimapClassName)}
        />
      )}
    </div>
  );
}

/** Where the zoomed canvas sits in the viewport, size pixels, so view's middle is in its middle. */
function canvasStyle({ zoom, x, y }: WheelView, { width, height }: ViewportSize) {
  const w = width * zoom;
  const h = height * zoom;
  return { width: w, height: h, left: width / 2 - x * w, top: height / 2 - y * h };
}

/** The view zoomed in on a cluster, with it in the middle. */
function zoomInOn(view: WheelView, { at }: WheelMarker): WheelView {
  return centerOn(zoomAt(view, CLUSTER_ZOOM, at), at);
}
