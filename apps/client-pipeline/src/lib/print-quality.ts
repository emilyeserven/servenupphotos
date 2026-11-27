import { PRINT_DPI } from "@/lib/photo-book-dpi";

/** The unit a print size is given in: inches or centimeters. */
export type PrintUnit = "in" | "cm";

/** A print's paper size, width by height, in its unit. Which way it's turned doesn't matter. */
export interface PrintSize {
  width: number;
  height: number;
  unit: PrintUnit;
}

/** A common print size to pick, such as "8 × 10 in" or "A4". */
export interface PresetSize extends PrintSize {
  /** Its name in the size picker. */
  label: string;
}

/** The common print sizes, in inches, then the A sizes in centimeters. */
export const PRESET_SIZES: readonly PresetSize[] = [
  { label: "4 × 6 in", width: 4, height: 6, unit: "in" },
  { label: "5 × 7 in", width: 5, height: 7, unit: "in" },
  { label: "8 × 10 in", width: 8, height: 10, unit: "in" },
  { label: "8.5 × 11 in (Letter)", width: 8.5, height: 11, unit: "in" },
  { label: "11 × 14 in", width: 11, height: 14, unit: "in" },
  { label: "12 × 18 in", width: 12, height: 18, unit: "in" },
  { label: "16 × 20 in", width: 16, height: 20, unit: "in" },
  { label: "18 × 24 in", width: 18, height: 24, unit: "in" },
  { label: "20 × 30 in", width: 20, height: 30, unit: "in" },
  { label: "24 × 36 in", width: 24, height: 36, unit: "in" },
  { label: "A5 (14.8 × 21 cm)", width: 14.8, height: 21, unit: "cm" },
  { label: "A4 (21 × 29.7 cm)", width: 21, height: 29.7, unit: "cm" },
  { label: "A3 (29.7 × 42 cm)", width: 29.7, height: 42, unit: "cm" },
  { label: "A2 (42 × 59.4 cm)", width: 42, height: 59.4, unit: "cm" },
];

/** The size the Printing pages start with: 8 × 10 in. */
const DEFAULT_PRINT_SIZE: PrintSize = { width: 8, height: 10, unit: "in" };

/** The preset with exactly this size, or undefined for a custom size. */
export function presetOf(size: PrintSize): PresetSize | undefined {
  return PRESET_SIZES.find(
    (p) => p.unit === size.unit && p.width === size.width && p.height === size.height,
  );
}

/** How a photo meets paper of another shape: cropped to fill it, or whole with borders. */
export type PrintFit = "fill" | "fit";

/** How sharp a print will look, from its pixels per inch. */
export type PrintRating = "excellent" | "good" | "fair" | "poor";

/** The lowest pixels per inch a good print needs: sharp at arm's length. */
export const GOOD_PPI = 200;

/** The lowest pixels per inch for each rating, best first; anything lower is poor. */
const RATING_FLOORS: readonly [Exclude<PrintRating, "poor">, number][] = [
  ["excellent", PRINT_DPI],
  ["good", GOOD_PPI],
  ["fair", 150],
];

/** The rating a print of ppi pixels per inch gets: 300 and up is excellent, under 150 poor. */
export function ratingOf(ppi: number): PrintRating {
  return RATING_FLOORS.find(([, floor]) => ppi >= floor)?.[0] ?? "poor";
}

/** What each rating means for the print, to show under it. */
export const RATING_TEXT: Record<PrintRating, { label: string; note: string }> = {
  excellent: { label: "Excellent", note: "Sharp even up close, the standard for photo prints." },
  good: { label: "Good", note: "Looks sharp at arm's length; fine for most prints." },
  fair: {
    label: "Fair",
    note: "Softness shows up close; fine for a large print seen from across a room.",
  },
  poor: { label: "Poor", note: "Likely to look soft or pixelated. Pick a smaller size." },
};

/** A width and height: in pixels for a photo, in inches or centimeters for a print. */
export interface Dimensions {
  width: number;
  height: number;
}

/** How a photo prints at a size: its sharpness, and how much of it or the paper goes unused. */
export interface PrintCheck {
  /** Dimensions per inch on the paper, rounded. */
  ppi: number;
  rating: PrintRating;
  /** The paper turned to match the photo (landscape for a wider photo), in inches. */
  paper: Dimensions;
  /** The share of the photo cropped away to fill the paper, from 0 to 1; 0 when fitted. */
  cropped: number;
  /** The share of the paper left blank around a fitted photo, from 0 to 1; 0 when filled. */
  blank: number;
}

/** How many of the unit make an inch. */
function perInch(unit: PrintUnit): number {
  return unit === "cm" ? 2.54 : 1;
}

/** A size in inches, given in the unit instead. */
export function inUnit({ width, height }: Dimensions, unit: PrintUnit): Dimensions {
  return { width: width * perInch(unit), height: height * perInch(unit) };
}

/** The print size in inches. */
function inches(size: PrintSize): Dimensions {
  return { width: size.width / perInch(size.unit), height: size.height / perInch(size.unit) };
}

/** The paper in inches, turned the same way as the photo; a square photo keeps it as given. */
function turnedPaper(photo: Dimensions, size: PrintSize) {
  const { width, height } = inches(size);
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  if (photo.width === photo.height) return { width, height };
  return photo.width > photo.height
    ? { width: long, height: short }
    : { width: short, height: long };
}

/**
 * How the photo prints on the paper. Filled, the side that runs out first sets the scale and the
 * rest of the photo is cropped away; fitted, the whole photo is on the paper and the side that
 * reaches the paper's edge first sets it. Null when the photo or size has no area.
 */
export function checkPrint(photo: Dimensions, size: PrintSize, fit: PrintFit): PrintCheck | null {
  if ([photo.width, photo.height, size.width, size.height].some((n) => !(n > 0))) return null;
  const paper = turnedPaper(photo, size);
  const across = photo.width / paper.width;
  const down = photo.height / paper.height;
  const ppi = fit === "fill" ? Math.min(across, down) : Math.max(across, down);
  // The share of the photo's pixels, and of the paper, the print uses.
  const usedPhoto = (paper.width * ppi * paper.height * ppi) / (photo.width * photo.height);
  const usedPaper = 1 / usedPhoto;
  return {
    ppi: Math.round(ppi),
    rating: ratingOf(ppi),
    paper,
    cropped: fit === "fill" ? Math.max(0, 1 - usedPhoto) : 0,
    blank: fit === "fit" ? Math.max(0, 1 - usedPaper) : 0,
  };
}

/** The largest print, in the unit given, the photo makes at ppi pixels per inch, uncropped. */
export function largestPrint(photo: Dimensions, ppi: number, unit: PrintUnit): Dimensions {
  return inUnit({ width: photo.width / ppi, height: photo.height / ppi }, unit);
}

/** A length for the page, such as "8" or "10.5", to one decimal place at most. */
function lengthText(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** A size for the page, such as "8 × 10 in". */
export function sizeText({ width, height }: Dimensions, unit: PrintUnit): string {
  return `${lengthText(width)} × ${lengthText(height)} ${unit}`;
}

/** The print size the Printing pages check photos at, and whether photos fill it or fit inside it. */
export interface PrintChoice {
  size: PrintSize;
  fit: PrintFit;
}

function isUnit(value: unknown): value is PrintUnit {
  return value === "in" || value === "cm";
}

/** A saved print size, or the default when it's missing or unreadable. */
function readSize(size: Partial<PrintSize> = {}): PrintSize {
  const ok = typeof size.width === "number" && typeof size.height === "number";
  return ok && isUnit(size.unit) ? (size as PrintSize) : DEFAULT_PRINT_SIZE;
}

/** A print choice as saved in the browser, or the default (8 × 10 in, filled) for anything unreadable. */
export function readPrintChoice(stored: unknown): PrintChoice {
  const saved = (stored ?? {}) as { size?: Partial<PrintSize>; fit?: unknown };
  return { size: readSize(saved.size), fit: saved.fit === "fit" ? "fit" : "fill" };
}
