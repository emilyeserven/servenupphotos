import { useMemo } from "react";
import { graysOf, LightnessSlider } from "@/components/lightness-slider";
import { PinBoard, type BoardLook } from "@/components/pin-board";
import type { KeepInside, WheelPoint } from "@/lib/color-wheel";
import { type VividMeasure, vividnessOf } from "@/lib/color-sort";
import type { LightnessRange } from "@/lib/lightness-range";
import type { PhotoImage } from "@/lib/photos";

/** A black and white photo the chart can place: its thumbnail, how light and how vivid it is. */
interface SpectrumPhoto {
  id: number;
  title: string;
  image: PhotoImage;
  lightness: number | null;
  vividness: number;
  peakVividness: number;
}

/** A pin's width in pixels. */
const PIN_PX = 32;

/** How far in from each side, as a fraction of the chart, the darkest and lightest photos sit. */
const MARGIN = 0.03;

/** The least span of vividness the chart's height stands for, so photos alike aren't spread up it. */
const MIN_SPAN = 2;

/** The range of vividness the chart's height stands for: the photos' least to their most, rounded out. */
function vividExtent(photos: SpectrumPhoto[], measure: VividMeasure): [number, number] {
  const values = photos.map((photo) => vividnessOf(photo, measure));
  if (values.length === 0) return [0, MIN_SPAN];
  const bottom = Math.floor(Math.min(...values));
  return [bottom, Math.max(bottom + MIN_SPAN, Math.ceil(Math.max(...values)))];
}

/** Keeps a pin inside a canvas of size pixels, so it doesn't hang over the edge. */
function keepInChart({ width, height }: { width: number; height: number }): KeepInside {
  return (p, size) => {
    const half = size / 2;
    p.x = Math.min(width - half, Math.max(half, p.x));
    p.y = Math.min(height - half, Math.max(half, p.y));
  };
}

/**
 * The chart as a pin board, filling the space it's given, shaded from the gray of extent's dark
 * end on the left to its light end on the right.
 */
function chartLook(extent: LightnessRange): BoardLook {
  return {
    pinSize: () => PIN_PX,
    keep: keepInChart,
    background: (
      <span
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{ backgroundImage: graysOf(extent) }}
      />
    ),
    className: "rounded-xl ring-1 ring-border",
    minimapClassName: "rounded-md",
    wholeLabel: "Show the whole chart",
  };
}

/**
 * The black and white photos as pins on a chart, like the color wheel's, fitted to the photos:
 * left to right across extent (the darkest to the lightest black and white photo) by how light
 * their grays are on average, and bottom to top from the least vivid photo shown to the most (by
 * measure). It zooms, pans and clusters crowded pins as a PinBoard does. The lightness axis is a
 * slider whose handles narrow it to range; photos outside it aren't given.
 */
export function ShadeSpectrum<T extends SpectrumPhoto>({
  photos,
  measure,
  range,
  extent,
  scale,
  onOpen,
}: {
  photos: T[];
  measure: VividMeasure;
  range: LightnessRange;
  extent: LightnessRange;
  /** How much bigger than small the pins are drawn. */
  scale: number;
  onOpen: (photo: T) => void;
}) {
  const [bottom, top] = vividExtent(photos, measure);
  const places = useMemo(
    () => photos.map((photo) => chartPoint(photo, measure, extent, [bottom, top])),
    [photos, measure, extent, bottom, top],
  );
  const look = useMemo(() => chartLook(extent), [extent]);
  return (
    <figure className="flex size-full flex-col gap-2">
      <div className="flex min-h-0 flex-1 gap-2">
        <span className="shrink-0 rotate-180 text-center text-xs text-muted-foreground [writing-mode:vertical-rl]">
          More vivid →
        </span>
        <div className="flex min-w-0 grow flex-col gap-2">
          <div className="min-h-0 flex-1">
            <PinBoard photos={photos} places={places} look={look} scale={scale} onOpen={onOpen} />
          </div>
          {/* Inset by the margin, so the slider's ends line up with the chart's. */}
          <div style={{ paddingInline: `${MARGIN * 100}%` }}>
            <LightnessSlider range={range} extent={extent} />
          </div>
        </div>
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">
        Black and white photos: across by how light they are, from {extent[0]} to {extent[1]}; up by{" "}
        {measure === "peak" ? "peak vividness" : "vividness"}, from {bottom} to {top}. Drag the gray
        bar&apos;s ends to narrow it.
      </figcaption>
    </figure>
  );
}

/**
 * A photo's place on the chart, as fractions of its width and height: across by its lightness
 * within extent, and up by its vividness within vivid.
 */
function chartPoint(
  photo: SpectrumPhoto,
  measure: VividMeasure,
  extent: LightnessRange,
  vivid: [number, number],
): WheelPoint {
  return {
    x: MARGIN + fractionOf(photo.lightness ?? 50, extent) * (1 - 2 * MARGIN),
    y: 1 - MARGIN - fractionOf(vividnessOf(photo, measure), vivid) * (1 - 2 * MARGIN),
  };
}

/** How far value is from range's low end to its high end, 0 to 1. */
function fractionOf(value: number, [low, high]: [number, number]): number {
  return (value - low) / Math.max(1, high - low);
}
