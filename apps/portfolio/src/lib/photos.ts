import committedData from "@/data/photos/ALLPHOTOS.json";
import {
  type Localized,
  localizeName,
  localizePlace,
  mapLocalized,
  type Place,
  placeById,
  SCRIPT_DISPLAYS,
  type ScriptDisplay,
} from "@/lib/localize";

export interface Photo {
  id: number;
  title: string;
  /** A note about the photo in Markdown, written on the pipeline's Photo page; null without one. */
  comment: string | null;
  camera: string;
  settings: CameraSettings;
  takenAt: Date;
  /** Null when the photo has no places, city or country, so there's nothing to say. */
  location: LocalizedLocation | null;
  /**
   * Null when the photo has no GPS position, nor any of its places, so it can't go on the map. A
   * place's is used when the EXIF has none.
   */
  latitude: number | null;
  longitude: number | null;
  /** Whether the map puts the photo at one of its places' GPS positions, as its EXIF has none. */
  approximatePosition: boolean;
  /** The photo's resized versions in R2; null for photos not uploaded yet. */
  image: PhotoImage | null;
}

/** Where the photo was taken, written each way the menu's Script Display can choose. */
export type LocalizedLocation = Record<ScriptDisplay, PhotoLocation>;

/** Where the photo was taken, as the portfolio shows it. */
export interface PhotoLocation {
  /** "Places, City", or else "City, Country", or else the country. */
  label: string;
  /** The lines shown on hover: the GPS position, then the country when the label leaves it out. */
  details: string[];
}

/** How the camera was set for the photo; each is null when its EXIF didn't say. */
export interface CameraSettings {
  /** The f-number, such as 5.6. */
  aperture: number | null;
  /** The exposure time in seconds as exiftool writes it, such as "1/60". */
  exposure: string | null;
  iso: number | null;
  /** The lens's focal length in millimeters, such as 18 or 4.2. */
  focalLength: number | null;
}

/** How each setting is written, in the order they're shown. */
export const SETTING_FORMATS: [keyof CameraSettings, (value: number | string) => string][] = [
  ["aperture", (value) => `f/${value}`],
  ["exposure", (value) => `${value}s`],
  ["iso", (value) => `ISO ${value}`],
  ["focalLength", (value) => `${value}mm`],
];

/** The settings as a photographer writes them, such as "f/5.6", "1/60s", "ISO 400" and "18mm". */
export function settingsText(settings: CameraSettings): string[] {
  return SETTING_FORMATS.flatMap(([key, write]) => {
    const value = settings[key];
    return value === null ? [] : [write(value)];
  });
}

export interface PhotoImage {
  /** The photo's size in pixels, as it's shown. */
  width: number;
  height: number;
  /** The Medium version, or the largest one below it. */
  src: string;
  /** The Small version, or the smallest one above it, or else the largest there is. */
  small: string;
  /** Every resized version, for the browser to pick from by its width. */
  srcSet: string;
  /** A tiny version to show blurred while a real one loads, when the photo has one. */
  preview?: string | null;
  /** The 500 × 500 square picked for square tiles, when the photo has one. */
  thumbnail?: string | null;
  /** A tiny version of the thumbnail's square to show blurred while it loads, when there is one. */
  thumbnailPreview?: string | null;
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
  /** The name to show, when one was written; older entries don't have it. */
  title?: string | null;
  /** A Markdown note about the photo, when one was written. */
  comment?: string | null;
  /** Entries saved before these were added don't have them. */
  aperture?: number | null;
  exposure?: string | null;
  iso?: number | null;
  focalLength?: number | null;
  camera: string | null;
  gpsPosition: string | null;
  createDate: string | null;
  /** A city and country written on the Photo page, shown instead of the EXIF ones; older entries don't have them. */
  customCity?: string | null;
  customCountry?: string | null;
  country: string | null;
  city: string | null;
  width: number | null;
  height: number | null;
  /** Older entries may be missing a version they were saved before. */
  images: Partial<Record<Version | "preview" | "thumbnail" | "thumbnailpreview", string | null>> & {
    /** The square the thumbnail was cut from, and its size; older entries don't have it. */
    thumbnailcrop?: { x: number; y: number; size: number; outputSize: number } | null;
  };
  /** Whether the photo may be posted to social media; older entries are missing it. */
  isSocialMediaEligible?: boolean;
  /** The photo's place among the photos spotlighted on the site; null or missing when it isn't. */
  websiteSpotlight?: number | null;
  /** The day the photo is scheduled to be posted to social media, as YYYY-MM-DD; null or missing when it isn't. */
  socialMediaPublishDate?: string | null;
  /** The places it was taken, from PLACES.json, each with how the photo relates to it; older entries don't have them. */
  places?: { relation: string; id: string }[];
  /** The IDs of the photo's albums and tags; older entries were saved without them. */
  albums?: string[];
  tags?: string[];
}

// ALLPHOTOS.local.json is made by `pnpm photos:local` (which `pnpm dev` runs) and git-ignored, so
// it's only there locally. A glob, unlike an import, doesn't fail when the file is missing.
const localData = Object.values(
  import.meta.glob<PhotoData[]>("../data/photos/ALLPHOTOS.local.json", {
    eager: true,
    import: "default",
  }),
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

type Position = ReturnType<typeof parseGpsPosition>;

const NO_POSITION: Position = { latitude: null, longitude: null };

/** The place's own GPS position, or else the nearest place above it that has one. */
function placePosition(id: string | undefined, passed = new Set<string>()): Position {
  const place = placeById(id);
  if (!place || passed.has(place.id)) return NO_POSITION;
  return ownPosition(place) ?? placePosition(place.parent, passed.add(place.id));
}

/** The GPS position set on the place itself, if both parts are. */
function ownPosition({ latitude, longitude }: Place): Position | undefined {
  return latitude === undefined || longitude === undefined ? undefined : { latitude, longitude };
}

/**
 * Where the photo goes on the map: its EXIF GPS position, or else the first of its places (or a
 * place it's in) with a GPS position set on the Places page.
 */
function photoPosition(photo: PhotoData): Position & { approximatePosition: boolean } {
  const exif = parseGpsPosition(photo.gpsPosition);
  if (exif.latitude !== null) return { ...exif, approximatePosition: false };
  const found = (photo.places ?? []).map(({ id }) => placePosition(id));
  const position = found.find(({ latitude }) => latitude !== null);
  return position
    ? { ...position, approximatePosition: true }
    : { ...NO_POSITION, approximatePosition: false };
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

/** The Small version, or the smallest one above it, or else the largest there is. */
function smallSrc(versions: ReturnType<typeof resizedVersions>, fallback: string) {
  return (
    (versions.find(({ longestEdge }) => longestEdge >= 500) ?? versions.at(-1))?.url ?? fallback
  );
}

function parseImage(photo: PhotoData): PhotoImage | null {
  const { width, height } = photo;
  if (!width || !height) return null;
  const versions = resizedVersions({ ...photo, width, height });
  const src = defaultSrc(versions);
  if (!src) return null;
  const small = smallSrc(versions, src);
  const srcSet = versions.map((version) => `${version.url} ${version.width}w`).join(", ");
  const { preview, thumbnail, thumbnailpreview } = photo.images;
  return {
    width,
    height,
    src,
    small,
    srcSet,
    preview,
    thumbnail,
    thumbnailPreview: thumbnailpreview,
  };
}

/** The title written on the Photo page, or else the file name without its extension. */
function photoTitle(photo: PhotoData): string {
  return photo.title?.trim() || photo.file.replace(/\.[^.]*$/, "");
}

function cameraSettings(photo: PhotoData): CameraSettings {
  const { aperture = null, exposure = null, iso = null, focalLength = null } = photo;
  return { aperture, exposure, iso, focalLength };
}

/** The Markdown comment written on the Photo page, or null without one. */
function photoComment(photo: PhotoData): string | null {
  return photo.comment?.trim() || null;
}

/** One coordinate as degrees, minutes and seconds, such as 37°31′21″ N. */
function dmsText(degrees: number, hemispheres: "NS" | "EW"): string {
  const seconds = Math.round(Math.abs(degrees) * 3600);
  const deg = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  const hemisphere = degrees < 0 ? hemispheres[1] : hemispheres[0];
  return `${deg}°${min}′${seconds % 60}″ ${hemisphere}`;
}

/** The GPS position as a photographer writes it, such as 37°31′21″ N, 126°58′46″ E. */
function gpsText({ latitude, longitude }: ReturnType<typeof parseGpsPosition>): string | null {
  if (latitude === null || longitude === null) return null;
  return `${dmsText(latitude, "NS")}, ${dmsText(longitude, "EW")}`;
}

/** The value written on the Photo page, or else the one from the EXIF; null when neither says. */
function custom(written: string | null | undefined, exif: string | null): string | null {
  return written?.trim() || exif || null;
}

/** The non-empty parts, joined with commas. */
function joinParts(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ");
}

/** One of the photo's places, with how it relates to it, such as "by Geunjeongmun Gate". */
function placePart(relation: string, name: Localized): Localized {
  return mapLocalized(name, (n, script) => [relation, n[script]].filter(Boolean).join(" "));
}

function capitalized(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The photo's places as a phrase, such as "In Gyeongbokgung Palace by Geunjeongmun Gate"; null
 * without any. Places missing from PLACES.json are left out. The old `placeName` isn't shown.
 */
function placeText(photo: PhotoData): Localized | null {
  const parts = (photo.places ?? []).flatMap(({ relation, id }) => {
    const place = placeById(id);
    return place ? [placePart(relation, localizePlace(place))] : [];
  });
  if (parts.length === 0) return null;
  return mapLocalized(parts, (p, script) => capitalized(p.map((part) => part[script]).join(" ")));
}

/** A city or country written each way, or null when there's none. */
function localizedField(type: "country" | "city", name: string | null): Localized | null {
  return name ? localizeName(type, name) : null;
}

/** The parts of where the photo was taken, each written every way. */
interface LocationParts {
  place: Localized | null;
  city: Localized | null;
  country: Localized | null;
  gps: string | null;
}

/** Where the photo was taken, written one way: see photoLocation. */
function locationIn(parts: LocationParts, script: ScriptDisplay): PhotoLocation {
  const [place, city, country] = [parts.place, parts.city, parts.country].map(
    (part) => part?.[script],
  );
  const label = place ? joinParts(place, city) : joinParts(city, country);
  // The country goes on hover only when the label leaves it out for the place.
  const details = [parts.gps, place ? country : null];
  return { label, details: details.filter(Boolean) as string[] };
}

/**
 * Where the photo was taken, with a custom city and country over the EXIF ones: its places and
 * city, with the country on hover; or else its city and country; or else its country. Each is
 * written every Script Display way. Null without any of them, even when it has a GPS position.
 */
function photoLocation(photo: PhotoData): LocalizedLocation | null {
  const parts: LocationParts = {
    place: placeText(photo),
    city: localizedField("city", custom(photo.customCity, photo.city)),
    country: localizedField("country", custom(photo.customCountry, photo.country)),
    gps: gpsText(parseGpsPosition(photo.gpsPosition)),
  };
  if (!parts.place && !parts.city && !parts.country) return null;
  return Object.fromEntries(
    SCRIPT_DISPLAYS.map((script) => [script, locationIn(parts, script)]),
  ) as LocalizedLocation;
}

/** The ALLPHOTOS.json entries the portfolio can place in time; ones without a date are left out. */
function fromPhotoData(data: PhotoData[]): Photo[] {
  return data.flatMap((photo, index) => {
    const takenAt = parseCreateDate(photo.createDate);
    if (!takenAt) return [];
    return {
      id: index + 1,
      title: photoTitle(photo),
      comment: photoComment(photo),
      settings: cameraSettings(photo),
      camera: photo.camera ?? "Unknown camera",
      takenAt,
      location: photoLocation(photo),
      ...photoPosition(photo),
      image: parseImage(photo),
    };
  });
}

const localPhotos = localData ? fromPhotoData(localData) : [];

/**
 * The photos in ALLPHOTOS.local.json when there are any (the photos in flight, locally), or else
 * the photos in data/photos/ALLPHOTOS.json, which the "Combine photo data" workflow builds.
 */
export const photos: Photo[] =
  localPhotos.length > 0 ? localPhotos : fromPhotoData(committedData as PhotoData[]);
