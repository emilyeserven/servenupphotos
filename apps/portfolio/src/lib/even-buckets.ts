import { exposureSeconds, RANGE_KEYS, type RangeKey } from "@portfolio/lib/camera-filters";
import { SETTING_FORMATS } from "@portfolio/lib/photo-settings";
import type { StatRow } from "@portfolio/lib/stat-groups";

/**
 * How a camera setting is cut into even ranges: what one step is called, the widths offered in
 * steps, which step a value is on, and a step's start written as the photos write the setting.
 */
interface EvenScale {
  unit: string;
  widths: number[];
  /** The step a value is on, counted from the scale's 0, such as 3 for f/2.8. */
  step: (value: number) => number;
  /** Where a step starts, written as the setting is, such as "2.8" or "1/250". */
  start: (step: number) => string;
}

/** The marked value nearest a number, counting in doublings, such as 60 for 64. */
function nearest(marks: number[], value: number): number {
  const off = (mark: number) => Math.abs(Math.log2(mark / value));
  return marks.reduce((best, mark) => (off(mark) < off(best) ? mark : best));
}

/** The marked shutter speeds, as seconds over a second and as the fraction's bottom under one. */
const LONG_SHUTTERS = [1, 2, 4, 8, 15, 30, 60];
const SHUTTERS = [2, 4, 8, 15, 30, 60, 125, 250, 500, 1000, 2000, 4000, 8000];

/** A shutter speed in seconds, written as cameras mark it: "1/250" under a second, "15" over. */
function shutterText(seconds: number): string {
  if (seconds >= 1) return String(nearest(LONG_SHUTTERS, seconds));
  return `1/${nearest(SHUTTERS, 1 / seconds)}`;
}

/** The marked full-stop f-numbers, which round off each √2. */
const F_STOPS = [1, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32, 45, 64];

/**
 * The camera settings' even scales. Aperture, exposure and ISO go in stops, where each step lets in
 * twice the light, as photographers count them; focal length goes in millimeters. The small
 * nudges put a marked value, such as f/11 (really f/11.3) or 1/60s (really 1/64s), on its own stop.
 */
const SCALES: Record<RangeKey, EvenScale> = {
  aperture: {
    unit: "stop",
    widths: [1, 2],
    step: (f) => Math.floor(2 * Math.log2(f) + 0.1),
    start: (step) => String(F_STOPS[step] ?? Math.round(Math.SQRT2 ** step)),
  },
  exposure: {
    unit: "stop",
    widths: [1, 2, 3],
    step: (seconds) => Math.floor(Math.log2(seconds) + 0.1),
    start: (step) => shutterText(2 ** step),
  },
  iso: {
    unit: "stop",
    widths: [1, 2],
    step: (iso) => Math.floor(Math.log2(iso / 100) + 0.1),
    start: (step) => String(Math.round(100 * 2 ** step)),
  },
  focalLength: {
    unit: "mm",
    widths: [10, 25, 50, 100],
    step: (mm) => Math.floor(mm),
    start: (step) => String(step),
  },
};

/** Whether the stat is a camera setting, which can be cut into even ranges. */
export function isEvenStat(stat: string): stat is RangeKey {
  return (RANGE_KEYS as readonly string[]).includes(stat);
}

/** The even widths offered for a camera setting, in its steps; none for any other stat. */
export function evenWidths(stat: string): number[] {
  return isEvenStat(stat) ? SCALES[stat].widths : [];
}

/** An even width as text, such as "Even ranges of 2 stops" or "Even ranges of 25 mm". */
export function evenText(stat: string, width: number): string {
  const unit = isEvenStat(stat) ? SCALES[stat].unit : "";
  const plural = unit === "stop" && width > 1 ? "s" : "";
  return `Even ranges of ${width} ${unit}${plural}`;
}

/** A setting row's value as the photos write it, read from its filter, such as "1/250" from "1/250-1/250". */
function rowValue(key: RangeKey, row: StatRow): string {
  return String(row.filter?.[key] ?? "").split("-")[0]!;
}

/** A setting row's value as a number, such as 1/250 for "1/250"; NaN when it has none. */
function rowNumber(key: RangeKey, row: StatRow): number {
  const value = rowValue(key, row);
  if (key !== "exposure") return Number(value);
  return exposureSeconds(value) ?? Number.NaN;
}

/** Which even range a row is in, counted from the scale's 0, such as 1 for f/2.8 in 2-stop ranges. */
function rangeIndex(scale: EvenScale, key: RangeKey, width: number, row: StatRow): number {
  return Math.floor(scale.step(rowNumber(key, row)) / width);
}

/** One even range: named from its start to the next one's, with its rows' photos, and 0 when it has none. */
function rangeRow(key: RangeKey, width: number, index: number, parts: StatRow[]): StatRow {
  const write = SETTING_FORMATS.find(([name]) => name === key)![1];
  const scale = SCALES[key];
  const label = `${write(scale.start(index * width))} – ${write(scale.start((index + 1) * width))}`;
  return { label, count: parts.reduce((sum, row) => sum + row.count, 0), parts };
}

/**
 * A camera setting's rows in even ranges, such as f/1.4 – f/2.8 then f/2.8 – f/5.6, lowest first.
 * Each range runs from its start up to the next one's, and empty ones between stay, so the axis
 * keeps an even scale.
 */
export function evenRows(rows: StatRow[], key: RangeKey, width: number): StatRow[] {
  const scale = SCALES[key];
  const placed = rows
    .map((row) => [rangeIndex(scale, key, width, row), row] as const)
    .filter(([index]) => Number.isFinite(index));
  if (placed.length === 0) return rows;
  const indexes = placed.map(([index]) => index);
  const low = Math.min(...indexes);
  return Array.from({ length: Math.max(...indexes) - low + 1 }, (_, i) =>
    rangeRow(
      key,
      width,
      low + i,
      placed.filter(([index]) => index === low + i).map(([, row]) => row),
    ),
  );
}
