import { mutationOptions } from "@tanstack/react-query";

interface Color {
  hex: string;
  lab: { l: number; a: number; b: number };
  hcl: { h: number; c: number; l: number };
}

interface ColorBucket {
  name: string;
  /** The bucket's reference color, for display. */
  hex: string;
  /** Fraction (0–1) of sampled pixels in this bucket. */
  share: number;
}

/** A histogram bin covering [from, to); share is of all sampled pixels. */
export interface Bin {
  from: number;
  to: number;
  hex?: string;
  share: number;
}

interface ChannelStats {
  name: string;
  min: number;
  p5: number;
  median: number;
  mean: number;
  p95: number;
  max: number;
  stdDev: number;
}

/** Lower-level data in go-colorful's native scales (mostly 0–1). */
export interface RawColorData {
  /** Per-channel stats in each color space; hue channels are left out. */
  spaces: { name: string; channels: ChannelStats[] }[];
  histograms: {
    /** HSV hue in 10° bins, non-neutral pixels only. */
    hue: Bin[];
    /** CIELAB L* (0–100). */
    lightness: Bin[];
    /** CIELAB chroma (0–100, higher values in the last bin). */
    chroma: Bin[];
    /** HSV saturation (0–1). */
    saturation: Bin[];
  };
}

export interface ColorAnalysis {
  average: Color;
  /** The 12 hue buckets in color-wheel order. */
  buckets: ColorBucket[];
  /** Pixels too dark or unsaturated to have a hue, by CIELAB lightness. */
  neutrals: { share: number; histogram: Bin[] };
  lightness: number;
  chroma: number;
  samples: number;
  raw: RawColorData;
}

/** The publishable subset of the EXIF data; a field is null when the photo lacks it. */
export interface SanitizedExif {
  camera: string | null;
  lens: string | null;
  gpsPosition: string | null;
  createDate: string | null;
  country: string | null;
  city: string | null;
  images: {
    /** The original photo's public R2 URL, once it has been uploaded. */
    full: string | null;
    /** The original photo's object key in the R2 bucket, once it has been uploaded. */
    key: string | null;
    /** Public R2 URLs of the resized WEBP versions, once they have been uploaded. */
    large: string | null;
    medium: string | null;
    small: string | null;
  };
}

export interface ExifResponse {
  file: string;
  /** Null when exiftool is not available on the backend. */
  exif: Record<string, unknown> | null;
  /** Null when exiftool is not available on the backend. */
  sanitized: SanitizedExif | null;
  colors: ColorAnalysis;
}

async function postPhoto(photo: File): Promise<ExifResponse> {
  const body = new FormData();
  body.append("photo", photo);

  const res = await fetch("/api/exif", { method: "POST", body });
  const json = (await res.json().catch(() => null)) as (ExifResponse & { message?: string }) | null;
  if (!res.ok) throw new Error(json?.message ?? `/api/exif responded ${res.status}`);
  return json as ExifResponse;
}

export const exifMutation = mutationOptions({
  mutationKey: ["exif"],
  mutationFn: postPhoto,
});
