import { useMemo } from "react";
import type { ColorDisplay } from "@/lib/color-display";
import { PinBoard, type BoardLook } from "@/components/pin-board";
import type { KeepInside, WheelPoint } from "@/lib/color-wheel";
import type { ChartUp } from "@/lib/color-display";
import { type VividMeasure, vividnessOf } from "@/lib/color-sort";
import { graysOf, type LightnessRange } from "@/lib/lightness-range";
import type { PhotoImage } from "@/lib/photos";

/** A black and white photo the chart can place: its thumbnail, how light, contrasty and vivid it is. */
interface SpectrumPhoto {
  id: number;
  title: string;
  image: PhotoImage;
  lightness: number | null;
  contrast: number | null;
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

/** The least span the chart's height stands for, so photos alike aren't spread up it. */
const MIN_SPAN = 2;

/**
 * How high a photo sits on the chart, before it's fitted to the chart: its contrast, or its
 * vividness by measure. A photo without its contrast saved sits at the middling 20.
 */
function heightOf(photo: SpectrumPhoto, up: ChartUp, measure: VividMeasure): number {
  return up === "contrast" ? (photo.contrast ?? 20) : vividnessOf(photo, measure);
}

/** The range of values the chart's height stands for: the photos' least to their most, rounded out. */
function heightExtent(values: number[]): [number, number] {
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
      <span aria-hidden className="absolute inset-0" style={{ backgroundImage: graysOf(extent) }} />
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
 * how light their grays are on average, and bottom to top from the flattest photo to the most
 * contrasty, or from the least vivid to the most (by measure), as the display options' chartUp
 * says. Its background shades from dark to light gray, so it needs no axis labels. It zooms, pans
 * and clusters crowded pins as a PinBoard does.
 */
export function ShadeSpectrum<T extends SpectrumPhoto>({
  photos,
  measure,
  extent,
  display,
  onOpen,
}: {
  photos: T[];
  measure: VividMeasure;
  extent: LightnessRange;
  /** The display options: the pins' size, how readily they're grouped, how groups look, and what's up. */
  display: ColorDisplay;
  onOpen: (photo: T) => void;
}) {
  const up = display.chartUp;
  const places = useMemo(() => {
    const heights = photos.map((photo) => heightOf(photo, up, measure));
    const range = heightExtent(heights);
    return photos.map((photo, i) => chartPoint(photo.lightness, heights[i]!, extent, range));
  }, [photos, up, measure, extent]);
  const look = useMemo(() => chartLook(extent), [extent]);
  return <PinBoard photos={photos} places={places} look={look} display={display} onOpen={onOpen} />;
}

/**
 * A photo's place on the chart, as fractions of its width and height: across by its lightness
 * within extent, and up by its height within range.
 */
function chartPoint(
  lightness: number | null,
  height: number,
  extent: LightnessRange,
  range: [number, number],
): WheelPoint {
  return {
    x: MARGIN + fractionOf(lightness ?? 50, extent) * (1 - 2 * MARGIN),
    y: 1 - BOTTOM_MARGIN - fractionOf(height, range) * (1 - BOTTOM_MARGIN - TOP_MARGIN),
  };
}

/** How far value is from range's low end to its high end, 0 to 1. */
function fractionOf(value: number, [low, high]: [number, number]): number {
  return (value - low) / Math.max(1, high - low);
}
