import { useMemo } from "react";
import { LightnessSlider } from "@/components/lightness-slider";
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

/**
 * The least vividness the chart's top stands for, so a page of only gray photos isn't stretched
 * up to the top as though they were tinted.
 */
const MIN_TOP = 10;

/** Keeps a pin inside a canvas of size pixels, so it doesn't hang over the edge. */
function keepInChart({ width, height }: { width: number; height: number }): KeepInside {
  return (p, size) => {
    const half = Math.min(size / 2, PIN_PX / 2);
    p.x = Math.min(width - half, Math.max(half, p.x));
    p.y = Math.min(height - half, Math.max(half, p.y));
  };
}

/** The chart as a pin board: half as tall as it's wide (240 to 420 pixels), black on the left to white on the right. */
const CHART_LOOK: BoardLook = {
  heightFor: (width) => Math.min(420, Math.max(240, Math.round(width / 2))),
  pinSize: () => PIN_PX,
  keep: keepInChart,
  background: (
    <span aria-hidden className="absolute inset-0 bg-linear-to-r from-black/25 to-white/25" />
  ),
  className: "rounded-xl ring-1 ring-border",
  minimapClassName: "rounded-md",
  wholeLabel: "Show the whole chart",
};

/**
 * The black and white photos as pins on a chart, like the color wheel's: left to right from black
 * to white by how light their grays are on average, and bottom to top by how vivid they are (by
 * measure), the most vivid at the top. It zooms, pans and clusters crowded pins as a PinBoard does.
 * The black-to-white axis is a slider whose handles narrow it to range; photos outside it aren't
 * given.
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
  const top = Math.max(MIN_TOP, ...photos.map((photo) => vividnessOf(photo, measure)));
  const places = useMemo(
    () => photos.map((photo) => chartPoint(photo, measure, top)),
    [photos, measure, top],
  );
  return (
    <figure className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <div className="flex gap-2">
        <span className="shrink-0 rotate-180 text-center text-xs text-muted-foreground [writing-mode:vertical-rl]">
          More vivid →
        </span>
        <div className="flex min-w-0 grow flex-col gap-3">
          <PinBoard photos={photos} places={places} look={CHART_LOOK} onOpen={onOpen} />
          {/* Inset by the margin, so the slider's ends line up with black and white on the chart. */}
          <div style={{ paddingInline: `${MARGIN * 100}%` }}>
            <LightnessSlider range={range} />
          </div>
        </div>
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">
        Black and white photos, whose grays make up nearly all of them: left to right by how light
        they are on average, and up by {measure === "peak" ? "peak vividness" : "vividness"}, the
        most vivid here, at {top}, at the top. Crowded pins are clustered until you zoom in. Drag
        the ends of the black-to-white bar to narrow it. The color wheel shows the rest.
      </figcaption>
    </figure>
  );
}

/** A photo's place on the chart, as fractions of its width and height. */
function chartPoint(photo: SpectrumPhoto, measure: VividMeasure, top: number): WheelPoint {
  const span = 1 - 2 * MARGIN;
  return {
    x: MARGIN + ((photo.lightness ?? 50) / 100) * span,
    y: 1 - MARGIN - (vividnessOf(photo, measure) / top) * span,
  };
}
