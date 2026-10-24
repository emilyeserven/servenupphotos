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
 * How wide each pin is, in pixels, for count pins on a wheel canvas wide: as big as they can be
 * while covering only PIN_COVER of the wheel between them, so a phone's smaller wheel still has
 * room to spread them out.
 */
function pinSize({ width }: ViewportSize, count: number): number {
  const wheelArea = Math.PI * (0.47 * width) ** 2;
  const fits = Math.sqrt((wheelArea * PIN_COVER) / Math.max(count, 1)) - PIN_GAP_PX;
  return Math.round(Math.min(MAX_PIN_PX, Math.max(MIN_PIN_PX, fits)));
}

/** The wheel as a pin board: square, its pins kept inside the circle of colors. */
const WHEEL_LOOK: BoardLook = {
  heightFor: (width) => width,
  pinSize,
  keep: ({ width }) => keepInWheel(width),
  background: (
    <span
      aria-hidden
      className="absolute inset-[3%] rounded-full opacity-70 shadow-inner"
      style={{ background: WHEEL_BACKGROUND }}
    />
  ),
  className: "rounded-xl",
  minimapClassName: "rounded-full",
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
  onOpen,
}: {
  photos: T[];
  measure: VividMeasure;
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
    <figure className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3">
      <PinBoard photos={photos} places={places} look={WHEEL_LOOK} onOpen={onOpen} />
      <figcaption className="text-center text-sm text-muted-foreground">
        Around the wheel by color, red at the top, pulled toward each photo&apos;s second color. Out
        from the middle by {measure === "peak" ? "peak vividness" : "vividness"}: the most vivid
        photo here, at {mostVivid}, is at the edge. Pins that would overlap are moved apart, and
        crowded ones are clustered until you zoom in. Black and white photos are on their own chart
        instead. Zoom with the buttons, a pinch or ctrl + scroll, and drag to look around.
      </figcaption>
    </figure>
  );
}
