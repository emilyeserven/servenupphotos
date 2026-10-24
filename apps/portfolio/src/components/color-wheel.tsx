import { useMemo } from "react";
import { PinBoard, type BoardLook } from "@/components/pin-board";
import { type VividMeasure, vividnessOf } from "@/lib/color-sort";
import { hueAngle, keepInWheel, WHEEL_BACKGROUND, wheelPoint } from "@/lib/color-wheel";
import type { ColorShare } from "@/lib/photo-colors";
import type { PhotoImage } from "@/lib/photos";
import { PIN_GAP_PX } from "@/lib/pin-markers";
import type { ViewportSize } from "@/lib/use-wheel-zoom";

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

/** A pin's widest and narrowest in pixels. */
const MAX_PIN_PX = 32;
const MIN_PIN_PX = 14;

/** How much of the wheel the pins may cover between them before they're made smaller to fit. */
const PIN_COVER = 0.5;

/**
 * How wide each pin is, in pixels, for count pins on a wheel canvas big: as big as they can be
 * while covering only PIN_COVER of the wheel between them, so a phone's smaller wheel still has
 * room to spread them out.
 */
function pinSize({ width, height }: ViewportSize, count: number): number {
  const wheelArea = Math.PI * (0.47 * width) * (0.47 * height);
  const fits = Math.sqrt((wheelArea * PIN_COVER) / Math.max(count, 1)) - PIN_GAP_PX;
  return Math.round(Math.min(MAX_PIN_PX, Math.max(MIN_PIN_PX, fits)));
}

/**
 * The wheel as a pin board, stretched to fill the space it's given, an oval when that isn't
 * square, its pins kept inside the oval of colors. The colors are drawn as a circle, then squashed
 * by the board's height over its width, so they stretch as the pins' places do.
 */
const WHEEL_LOOK: BoardLook = {
  pinSize,
  keep: ({ width, height }) => keepInWheel(width, height),
  background: (
    <span
      aria-hidden
      className="absolute top-0 left-0 aspect-square w-full origin-top"
      style={{ transform: "scaleY(var(--board-aspect))" }}
    >
      <span
        className="absolute inset-[3%] rounded-full opacity-70"
        style={{ background: WHEEL_BACKGROUND }}
      />
    </span>
  ),
  className: "rounded-xl",
  minimapClassName: "rounded-[50%]",
  wholeLabel: "Show the whole wheel",
};

/**
 * The photos as pins on a color wheel, like the Map page's: around it by hue, red at the top, and
 * out from the gray middle by vividness (by measure), the most vivid at the edge. Clicking a pin
 * opens the photo. It zooms, pans and clusters crowded pins as a PinBoard does.
 */
export function ColorWheel<T extends WheelPhoto>({
  photos,
  measure,
  scale,
  onOpen,
}: {
  photos: T[];
  measure: VividMeasure;
  /** How much bigger than small the pins are drawn. */
  scale: number;
  onOpen: (photo: T) => void;
}) {
  const mostVivid = Math.max(MIN_EDGE, ...photos.map((photo) => vividnessOf(photo, measure)));
  const places = useMemo(
    () =>
      photos.map((photo) =>
        wheelPoint(hueAngle(photo.palette), vividnessOf(photo, measure), mostVivid),
      ),
    [photos, measure, mostVivid],
  );
  return (
    <figure className="flex size-full flex-col gap-2">
      <div className="min-h-0 flex-1">
        <PinBoard photos={photos} places={places} look={WHEEL_LOOK} scale={scale} onOpen={onOpen} />
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        Around by color, red at the top, pulled toward each photo&apos;s second color; out from the
        gray middle by {measure === "peak" ? "peak vividness" : "vividness"}, up to {mostVivid}.
        Crowded pins are clustered until you zoom in.
      </figcaption>
    </figure>
  );
}
