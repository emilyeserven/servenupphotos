import type { PhotoPlace } from "@/api/places";
import { mutationOptions } from "@tanstack/react-query";
import type { ThumbnailCrop } from "@/api/versions";

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

/** A photo's color summary, as its photo JSON file keeps it under `colors`. */
export interface ColorSummary {
  average: Color;
  /** The 12 hue buckets in color-wheel order. */
  buckets: ColorBucket[];
  /** Pixels too dark or unsaturated to have a hue, by CIELAB lightness. */
  neutrals: { share: number; histogram: Bin[] };
  lightness: number;
  chroma: number;
  samples: number;
}

/** A photo's color summary with its raw statistics. */
export interface ColorAnalysis extends ColorSummary {
  raw: RawColorData;
}

/** The publishable subset of the EXIF data; a field is null when the photo lacks it. */
export interface SanitizedExif {
  /** The photo's name on the portfolio, written on the Photo page; the portfolio uses the file name without one. */
  title: string | null;
  camera: string | null;
  lens: string | null;
  /** The f-number, such as 5.6 for f/5.6. */
  aperture: number | null;
  /** The exposure time in seconds as exiftool writes it, such as "1/60" or "2". */
  exposure: string | null;
  iso: number | null;
  /** The lens's focal length in millimeters, such as 18 or 4.2. */
  focalLength: number | null;
  gpsPosition: string | null;
  /** A GPS position written on the Photo page as "latitude, longitude", which the portfolio uses instead of the EXIF one. */
  customGpsPosition?: string | null;
  createDate: string | null;
  /** The name of the place the photo was taken, such as a park or building, written on the Photo page. */
  placeName: string | null;
  /**
   * Where the photo was taken, as places from PLACES.json, each with how the photo relates to it,
   * chosen on the Photo page. Saved as the JSON's "places", next to its albums and tags.
   */
  places?: PhotoPlace[];
  /** A city, state and country written on the Photo page, which the portfolio shows instead of the EXIF ones. */
  customCity: string | null;
  customState?: string | null;
  customCountry: string | null;
  country: string | null;
  /** The state, province or prefecture from the EXIF, between the city and the country. */
  state?: string | null;
  city: string | null;
  /** The original photo's width and height in pixels, as shown (turned upright from its EXIF orientation). */
  width: number | null;
  height: number | null;
  /** The photographer's note about the photo, in Markdown, written on the Photo page. */
  comment: string | null;
  images: {
    /** The original photo's public R2 URL, once it has been uploaded. */
    full: string | null;
    /** The original photo's object key in the R2 bucket, once it has been uploaded. */
    key: string | null;
    /** Public R2 URLs of the resized WEBP versions, once they have been uploaded. */
    xlarge: string | null;
    large: string | null;
    medium: string | null;
    small: string | null;
    xsmall: string | null;
    preview: string | null;
    /** Public R2 URL of the 500 × 500 WEBP cut from the square picked before uploading. */
    thumbnail: string | null;
    /** Public R2 URL of a tiny 40 × 40 WEBP of the same square, to show blurred while it loads. */
    thumbnailpreview: string | null;
    /** The square of the photo the Square Thumbnail is cut from, once it has been uploaded. */
    thumbnailcrop: ThumbnailCrop | null;
  };
  /** Whether the photo may be posted to social media, such as Instagram. */
  isSocialMediaEligible: boolean;
  /** The photo's place among the photos spotlighted on the site, or null when it isn't spotlighted. */
  websiteSpotlight: number | null;
  /** The day the photo is scheduled to be posted to social media, as YYYY-MM-DD; null when it isn't. */
  socialMediaPublishDate: string | null;
  /**
   * The EXIF values of the fields a camera override changed, by field, such as `{ lens: "21.0 mm" }`,
   * so the overrides can be applied again after they change. Null before the backend applies them.
   */
  exifOriginals: Record<string, string | number | boolean | null> | null;
  /** Whether the photo has no aperture because it was set on the lens by hand or isn't known. */
  manualAperture: boolean;
  /** The ID of the custom lens chosen for the photo on the Photo page, or null for none. */
  customLens: string | null;
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
