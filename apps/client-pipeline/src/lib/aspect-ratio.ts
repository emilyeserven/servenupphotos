import type { MeasuredImage } from "@/api/image-sizes";
import type { QualityFlag } from "@/lib/quality-flags";

/** Which way a photo is turned: wider than tall, taller than wide, or square. */
export type PhotoShape = "landscape" | "portrait" | "square";

/** A house aspect ratio: its name, such as "16:9", and width divided by height. */
interface HouseRatio {
  label: string;
  ratio: number;
}

/** The house aspect ratios every photo is cropped to: 16:9 when it's wider, 5:7 when it's taller. */
const HOUSE_RATIOS: Record<Exclude<PhotoShape, "square">, HouseRatio> = {
  landscape: { label: "16:9", ratio: 16 / 9 },
  portrait: { label: "5:7", ratio: 5 / 7 },
};

/**
 * How far a photo's ratio can be from its house ratio and still pass, as a share of the house
 * ratio: 1%, which is room for a Small version's size being rounded to whole pixels.
 */
const ASPECT_TOLERANCE = 0.01;

/** Common crops, to name the ratio a photo has instead, such as "3:2". */
const COMMON_RATIOS: [number, number][] = [
  [16, 9],
  [3, 2],
  [4, 3],
  [5, 4],
  [1, 1],
  [4, 5],
  [5, 7],
  [3, 4],
  [2, 3],
  [9, 16],
  [21, 9],
  [2, 1],
  [1, 2],
];

/** A photo that isn't its house aspect ratio: what it is, and what it should be. */
export interface AspectProblem {
  shape: PhotoShape;
  /** The ratio it should be, such as "16:9", or "16:9 or 5:7" for a square photo. */
  wanted: string;
  /** The ratio it is: a common crop it's within 1% of, such as "3:2", or else such as "1.62:1". */
  actual: string;
  /** How far it is from the ratio it should be, in percent, to one decimal place. */
  offBy: number;
}

/** The photo's shape from its width and height. */
export function shapeOf(width: number, height: number): PhotoShape {
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

/** The ratio width:height is, named as a common crop when it's within 1% of one. */
function ratioName(width: number, height: number): string {
  const ratio = width / height;
  const common = COMMON_RATIOS.find(([w, h]) => Math.abs(ratio / (w / h) - 1) <= ASPECT_TOLERANCE);
  if (common) return `${common[0]}:${common[1]}`;
  return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`;
}

/**
 * What's wrong with a photo of this size, or null when it's its house ratio, 16:9 for a landscape
 * photo or 5:7 for a portrait one, within `tolerance`. A square photo is neither.
 */
export function aspectProblem(
  width: number,
  height: number,
  tolerance = ASPECT_TOLERANCE,
): AspectProblem | null {
  const shape = shapeOf(width, height);
  const actual = ratioName(width, height);
  if (shape === "square") {
    // Measured against the nearer house ratio, 5:7.
    const off = Math.abs(1 / HOUSE_RATIOS.portrait.ratio - 1);
    return { shape, wanted: "16:9 or 5:7", actual, offBy: Math.round(off * 1000) / 10 };
  }
  const house = HOUSE_RATIOS[shape];
  const off = Math.abs(width / height / house.ratio - 1);
  if (off <= tolerance) return null;
  return { shape, wanted: house.label, actual, offBy: Math.round(off * 1000) / 10 };
}

/** What the photo's re-edit mark says, such as "Crop to 16:9". */
function aspectReEditReason(problem: AspectProblem): string {
  return problem.shape === "square" ? "Crop to 16:9 or 5:7" : `Crop to ${problem.wanted}`;
}

/**
 * The photographer note saying why the photo failed the check, such as "Quality Check (aspect ratio): the Small
 * version is 640 × 427 (3:2), not the 16:9 crop for a landscape photo."
 */
function aspectNote(width: number, height: number, problem: AspectProblem): string {
  const size = `${width} × ${height} (${problem.actual})`;
  const wanted =
    problem.shape === "square"
      ? "a house crop: 16:9 for a landscape photo or 5:7 for a portrait one"
      : `the ${problem.wanted} crop for a ${problem.shape} photo`;
  return `Quality Check (aspect ratio): the Small version is ${size}, not ${wanted}.`;
}

/** A photo that failed the aspect ratio check, with its re-edit flag and what was found. */
export interface AspectFlag<T> {
  entry: T;
  flag: QualityFlag;
  /** What the check found, such as "640 × 427 (3:2), 6.3% off 16:9". */
  detail: string;
}

/** The photos a check found off the house ratios, and the ones whose Small version couldn't be read. */
export interface AspectCheck<T> {
  items: AspectFlag<T>[];
  unread: T[];
  /** How many photos' Small versions were read and checked. */
  read: number;
}

/** The flag for a photo of this size, or null when it's a house ratio. */
function aspectFlag<T>(entry: T, { width, height }: MeasuredImage): AspectFlag<T> | null {
  const problem = aspectProblem(width, height);
  if (!problem) return null;
  return {
    entry,
    flag: { reason: aspectReEditReason(problem), note: aspectNote(width, height, problem) },
    detail: `${width} × ${height} (${problem.actual}), ${problem.offBy}% off ${problem.wanted}`,
  };
}

/** Whether the size was read: it has no error and both sides. */
function wasRead(size: MeasuredImage | undefined): size is MeasuredImage {
  return size !== undefined && !size.error && size.width > 0 && size.height > 0;
}

/** Checks each photo's Small version, measured in `sizes` by its `imageUrl`, against the house ratios. */
export function checkAspectRatios<T extends { imageUrl: string }>(
  photos: T[],
  sizes: MeasuredImage[],
): AspectCheck<T> {
  const byUrl = new Map(sizes.map((size) => [size.url, size]));
  const result: AspectCheck<T> = { items: [], unread: [], read: 0 };
  for (const entry of photos) {
    const size = byUrl.get(entry.imageUrl);
    if (!wasRead(size)) result.unread.push(entry);
    else {
      result.read++;
      const flagged = aspectFlag(entry, size);
      if (flagged) result.items.push(flagged);
    }
  }
  return result;
}
