import dummyData from "@/data/dummy.json";

export interface Photo {
  id: number;
  title: string;
  camera: string;
  takenAt: Date;
  location: string;
  /** Null when the photo has no GPS position, so it can't go on the map. */
  latitude: number | null;
  longitude: number | null;
  /** The photo's resized versions in R2; null for the dummy data and photos not uploaded yet. */
  image: PhotoImage | null;
}

export interface PhotoImage {
  /** The photo's size in pixels, as it's shown. */
  width: number;
  height: number;
  /** The Medium version, or the largest one below it. */
  src: string;
  /** Every resized version, for the browser to pick from by its width. */
  srcSet: string;
  /** A tiny version to show blurred while a real one loads, when the photo has one. */
  preview?: string | null;
  /** The 500 × 500 square picked for square tiles, when the photo has one. */
  thumbnail?: string | null;
}

/** The resized versions the pipeline makes, smallest first, with their longest edge in pixels. */
const VERSIONS = [
  ["xsmall", 250],
  ["small", 500],
  ["medium", 1200],
  ["large", 1800],
  ["xlarge", 2500],
] as const;

type Version = (typeof VERSIONS)[number][0];

/** One entry of ALLPHOTOS.json: a photo's file name and sanitized EXIF, as the pipeline saves it. */
interface PhotoData {
  file: string;
  camera: string | null;
  gpsPosition: string | null;
  createDate: string | null;
  country: string | null;
  city: string | null;
  width: number | null;
  height: number | null;
  /** Older entries may be missing a version they were saved before. */
  images: Partial<Record<Version | "preview" | "thumbnail", string | null>>;
}

// ALLPHOTOS.local.json is made by `pnpm photos:local` (which `pnpm dev` runs) and git-ignored, so
// it's only there locally. A glob, unlike an import, doesn't fail when the file is missing.
const localData = Object.values(
  import.meta.glob<PhotoData[]>("../data/ALLPHOTOS.local.json", { eager: true, import: "default" }),
)[0];

/** Exiftool's "2026:05:16 15:24:10" (sometimes with a time zone after it), as local time. */
function parseCreateDate(value: string | null): Date | null {
  const match = value?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})/);
  if (!match) return null;
  // An ISO date and time without a time zone is read as local time.
  const [, year, month, day, time] = match;
  return new Date(`${year}-${month}-${day}T${time}`);
}

/**
 * One coordinate of exiftool's `37 deg 31' 21.06" N, 126 deg 58' 46.24" E`, in decimal degrees.
 * `hemispheres` lists the positive hemisphere first: "NS" for latitude, "EW" for longitude.
 */
function parseCoordinate(value: string, hemispheres: "NS" | "EW"): number | null {
  const number = String.raw`(\d+(?:\.\d+)?)`;
  const match = value.match(new RegExp(`${number} deg ${number}' ${number}" ([${hemispheres}])`));
  if (!match) return null;
  const [, deg, min, sec, hemisphere] = match;
  const degrees = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return hemisphere === hemispheres[0] ? degrees : -degrees;
}

function parseGpsPosition(value: string | null) {
  const [lat = "", lng = ""] = value?.split(",") ?? [];
  const latitude = parseCoordinate(lat, "NS");
  const longitude = parseCoordinate(lng, "EW");
  return latitude === null || longitude === null
    ? { latitude: null, longitude: null }
    : { latitude, longitude };
}

/** The resized versions' URLs with their widths: a version keeps the photo's size when it's already smaller. */
function resizedVersions({ width, height, images }: PhotoData & { width: number; height: number }) {
  return VERSIONS.flatMap(([name, longestEdge]) => {
    const url = images[name];
    const scale = Math.min(1, longestEdge / Math.max(width, height));
    return url ? [{ url, longestEdge, width: Math.round(width * scale) }] : [];
  });
}

/** The Medium version, or the largest one below it, or else the smallest there is. */
function defaultSrc(versions: ReturnType<typeof resizedVersions>) {
  return (versions.findLast(({ longestEdge }) => longestEdge <= 1200) ?? versions[0])?.url;
}

function parseImage(photo: PhotoData): PhotoImage | null {
  const { width, height } = photo;
  if (!width || !height) return null;
  const versions = resizedVersions({ ...photo, width, height });
  const src = defaultSrc(versions);
  if (!src) return null;
  const srcSet = versions.map((version) => `${version.url} ${version.width}w`).join(", ");
  const { preview, thumbnail } = photo.images;
  return { width, height, src, srcSet, preview, thumbnail };
}

/** The local ALLPHOTOS.json entries the portfolio can place in time; ones without a date are left out. */
function fromPhotoData(data: PhotoData[]): Photo[] {
  return data.flatMap((photo, index) => {
    const takenAt = parseCreateDate(photo.createDate);
    if (!takenAt) return [];
    return {
      id: index + 1,
      title: photo.file.replace(/\.[^.]*$/, ""),
      camera: photo.camera ?? "Unknown camera",
      takenAt,
      location: [photo.city, photo.country].filter(Boolean).join(", ") || "Unknown location",
      ...parseGpsPosition(photo.gpsPosition),
      image: parseImage(photo),
    };
  });
}

// Dummy data until real photos are wired up for the deployed site: about two years of shoot days,
// each with a handful of photos taken around one city.
const dummyPhotos: Photo[] = dummyData.map((photo) => ({
  ...photo,
  takenAt: new Date(photo.takenAt),
  image: null,
}));

const localPhotos = localData ? fromPhotoData(localData) : [];

/** The photos in ALLPHOTOS.local.json when there are any, or else the dummy data. */
export const photos: Photo[] = localPhotos.length > 0 ? localPhotos : dummyPhotos;
