import { useMemo } from "react";
import { PinBoard, type BoardLook } from "@/components/pin-board";
import type { KeepInside, WheelPoint } from "@/lib/color-wheel";
import { type VividMeasure, vividnessOf } from "@/lib/color-sort";
import { graysOf, type LightnessRange } from "@/lib/lightness-range";
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

/**
 * How far down, as a fraction of the chart, the most vivid photos sit, below where its top fades
 * in from the page's background.
 */
const TOP_MARGIN = 0.12;

/** How far up, as a fraction of the chart, the least vivid photos sit, clear of the screen's bottom. */
const BOTTOM_MARGIN = 0.06;

/** The least gap, in pixels, kept between a pin and the chart's edges. */
const EDGE_PX = 12;

/** The least span of vividness the chart's height stands for, so photos alike aren't spread up it. */
const MIN_SPAN = 2;

/** The range of vividness the chart's height stands for: the photos' least to their most, rounded out. */
function vividExtent(photos: SpectrumPhoto[], measure: VividMeasure): [number, number] {
  const values = photos.map((photo) => vividnessOf(photo, measure));
  if (values.length === 0) return [0, MIN_SPAN];
  const bottom = Math.floor(Math.min(...values));
  return [bottom, Math.max(bottom + MIN_SPAN, Math.ceil(Math.max(...values)))];
}

/** Keeps a pin inside a canvas of size pixels, a little in from the edge. */
function keepInChart({ width, height }: { width: number; height: number }): KeepInside {
  return (p, size) => {
    const half = size / 2 + EDGE_PX;
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
    className: "",
    minimapClassName: "rounded-md",
    wholeLabel: "Show the whole chart",
    fadeTop: true,
  };
}

/**
 * The black and white photos as pins on a chart filling the page, like the color wheel's, fitted to
 * the photos: left to right across extent (the darkest to the lightest black and white photo) by
 * how light their grays are on average, and bottom to top from the least vivid photo to the most
 * (by measure). Its background shades from dark to light gray, so it needs no axis labels. It
 * zooms, pans and clusters crowded pins as a PinBoard does.
 */
export function ShadeSpectrum<T extends SpectrumPhoto>({
  photos,
  measure,
  extent,
  scale,
  onOpen,
}: {
  photos: T[];
  measure: VividMeasure;
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
  return <PinBoard photos={photos} places={places} look={look} scale={scale} onOpen={onOpen} />;
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
    y:
      1 -
      BOTTOM_MARGIN -
      fractionOf(vividnessOf(photo, measure), vivid) * (1 - BOTTOM_MARGIN - TOP_MARGIN),
  };
}

/** How far value is from range's low end to its high end, 0 to 1. */
function fractionOf(value: number, [low, high]: [number, number]): number {
  return (value - low) / Math.max(1, high - low);
}
