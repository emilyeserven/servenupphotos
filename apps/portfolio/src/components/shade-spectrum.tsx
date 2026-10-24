import { useMemo } from "react";
import { LightnessSlider } from "@/components/lightness-slider";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { type KeepInside, spreadPins, type WheelPoint } from "@/lib/color-wheel";
import { type VividMeasure, vividnessOf } from "@/lib/color-sort";
import type { LightnessRange } from "@/lib/lightness-range";
import type { PhotoImage } from "@/lib/photos";
import { useWidth } from "@/lib/use-width";

/** A black and white photo the chart can place: its thumbnail, how light and how vivid it is. */
interface SpectrumPhoto {
  id: number;
  title: string;
  image: PhotoImage;
  lightness: number | null;
  vividness: number;
  peakVividness: number;
}

/** A pin's width in pixels, and the gap kept between pins when they're spread apart. */
const PIN_PX = 32;
const PIN_GAP_PX = 3;

/**
 * The least vividness the chart's top stands for, so a page of only gray photos isn't stretched
 * up to the top as though they were tinted.
 */
const MIN_TOP = 10;

/** The chart's height for its width: half as tall, but never under 240 or over 420 pixels. */
function chartHeight(width: number): number {
  return Math.min(420, Math.max(240, Math.round(width / 2)));
}

/**
 * The black and white photos as pins on a chart, like the color wheel's: left to right from black
 * to white by how light their grays are on average, and bottom to top by how vivid they are (by
 * measure), the most vivid at the top. Pins that would overlap are moved apart. Clicking a pin
 * opens the photo. The black-to-white axis is a slider whose handles narrow it to range; photos
 * outside it aren't given.
 */
export function ShadeSpectrum<T extends SpectrumPhoto>({
  photos,
  measure,
  range,
  onOpen,
}: {
  photos: T[];
  measure: VividMeasure;
  range: LightnessRange;
  onOpen: (photo: T) => void;
}) {
  const [ref, width] = useWidth();
  const height = chartHeight(width);
  const top = Math.max(MIN_TOP, ...photos.map((photo) => vividnessOf(photo, measure)));
  const points = useMemo(
    () => chartPoints(photos, measure, top, width, height),
    [photos, measure, top, width, height],
  );
  return (
    <figure className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <div className="flex gap-2">
        <span className="shrink-0 text-xs text-muted-foreground [writing-mode:vertical-rl] rotate-180 text-center">
          More vivid →
        </span>
        <div className="flex min-w-0 grow flex-col gap-3">
          <div
            ref={ref}
            className="relative w-full rounded-xl bg-linear-to-r from-black/25 to-white/25 ring-1 ring-border"
            style={{ height }}
          >
            {width > 0 &&
              photos.map((photo, i) => (
                <SpectrumPin
                  key={photo.id}
                  photo={photo}
                  at={points[i]!}
                  onOpen={() => onOpen(photo)}
                />
              ))}
          </div>
          {/* Inset by half a pin, so the slider's ends line up with the pins at black and white. */}
          <div style={{ paddingInline: PIN_PX / 2 }}>
            <LightnessSlider range={range} />
          </div>
        </div>
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">
        Black and white photos, whose grays make up nearly all of them: left to right by how light
        they are on average, and up by {measure === "peak" ? "peak vividness" : "vividness"}, the
        most vivid here, at {top}, at the top. Drag the ends of the black-to-white bar to narrow it.
        The color wheel shows the rest.
      </figcaption>
    </figure>
  );
}

/** Each photo's pin's middle, in pixels from the chart's top left, spread so pins don't overlap. */
function chartPoints(
  photos: SpectrumPhoto[],
  measure: VividMeasure,
  top: number,
  width: number,
  height: number,
): WheelPoint[] {
  const places = photos.map((photo) => ({
    x: PIN_PX / 2 + ((photo.lightness ?? 50) / 100) * Math.max(0, width - PIN_PX),
    y: height - PIN_PX / 2 - (vividnessOf(photo, measure) / top) * (height - PIN_PX),
  }));
  return width > 0 ? spreadPins(places, PIN_PX + PIN_GAP_PX, keepIn(width, height)) : places;
}

/** Keeps a pin's middle far enough inside a width by height chart that the pin doesn't hang over its edge. */
function keepIn(width: number, height: number): KeepInside {
  return (p, size) => {
    const half = Math.min(size / 2, PIN_PX / 2);
    p.x = Math.min(width - half, Math.max(half, p.x));
    p.y = Math.min(height - half, Math.max(half, p.y));
  };
}

/** A photo's pin: its square thumbnail, centered at at, in pixels. */
function SpectrumPin({
  photo,
  at,
  onOpen,
}: {
  photo: SpectrumPhoto;
  at: WheelPoint;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={onOpen}
      className="absolute block -translate-x-1/2 -translate-y-1/2 cursor-zoom-in overflow-hidden rounded-md bg-muted shadow-md shadow-black/30 ring-2 ring-white outline-none transition-transform hover:z-10 hover:scale-150 focus-visible:z-10 focus-visible:scale-150 focus-visible:ring-sky-500"
      style={{ left: at.x, top: at.y, width: PIN_PX, height: PIN_PX }}
    >
      <PhotoThumbnail image={photo.image} />
    </button>
  );
}
