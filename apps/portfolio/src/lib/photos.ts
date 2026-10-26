import committedData from "@/data/photos/ALLPHOTOS.json";
import {
  type ColorShare,
  type PhotoColorData,
  photoColors,
  photoContrast,
  photoLightness,
  photoPeakVividness,
  photoVividness,
} from "@/lib/photo-colors";
import {
  type Localized,
  localizeName,
  mainName,
  localizePlace,
  mapLocalized,
  type Place,
  placeAncestry,
  placeById,
  SCRIPT_DISPLAYS,
  type ScriptDisplay,
} from "@/lib/localize";

export interface Photo {
  /**
   * The photo's ID from its JSON file, which links to it use, such as `/grid?photo=12`. A photo
   * saved before IDs gets one after the highest, by its place in ALLPHOTOS.json, until Update Data
   * gives it its own; that one can change when photos are added.
   */
  id: number;
  title: string;
  /** A note about the photo in Markdown, written on the pipeline's Photo page; null without one. */
  comment: string | null;
  camera: string;
  /** The lens's model, as the EXIF names it; null when it didn't say. */
  lens: string | null;
  settings: CameraSettings;
  takenAt: Date;
  /**
   * When the photo went on the portfolio: when it stopped being a draft in the pipeline, or for
   * older photos, when its file was first committed. Null until Update Data dates it.
   */
  addedAt: Date | null;
  /** Null when the photo has no places, city or country, so there's nothing to say. */
  location: LocalizedLocation | null;
  /**
   * Null when the photo has no GPS position, nor any of its places, so it can't go on the map. A
   * place's is used when the EXIF has none.
   */
  latitude: number | null;
  longitude: number | null;
  /**
   * Whether the map puts the photo at one of its places' GPS positions, as its EXIF has none, and
   * that place isn't marked as an exact location.
   */
  approximatePosition: boolean;
  /** The photo's resized versions in R2; null for photos not uploaded yet. */
  image: PhotoImage | null;
  /**
   * The country, state and city it was taken in, in English, as the location filter matches them:
   * the custom ones, or else the EXIF ones, or else the first of its places (or a place it's in)
   * that says. Null when none of them do.
   */
  country: string | null;
  state: string | null;
  city: string | null;
  /** The IDs of the places it lists and every place those are in, for the location filter. */
  placeIds: string[];
  /** The IDs of the albums and tags it's in; empty for older entries saved without them. */
  albums: string[];
  /**
   * Its place among the photos picked for the homepage before spotlight zones showed albums, 1
   * first; null without one. An album lists the photos that have one first, in that order.
   */
  spotlightPlace: number | null;
  tags: string[];
  /** The IDs of the photographic genres it's in, such as "street"; empty for older entries. */
  genres: string[];
  /** The point of the photo kept in view when the screen is the other way round, set on its Photo page; null keeps the middle. */
  spotlightFocus: SpotlightFocus | null;
  /**
   * How its colors split between the 12 hue buckets and the shades from black to white, biggest
   * first; empty until the pipeline saves its colors.
   */
  palette: ColorShare[];
  /** How vivid its colors are, its mean CIELAB chroma rounded; null until the pipeline saves its colors. */
  vividness: number | null;
  /** How vivid its most vivid tenth is, its peak CIELAB chroma rounded; null until the pipeline saves its colors. */
  peakVividness: number | null;
  /** How light its blacks, grays and whites are on average, from 0 to 100; null until the pipeline saves its colors. */
  lightness: number | null;
  /**
   * How far its blacks, grays and whites spread from that average, from about 10 for a flat photo to
   * 30 or more for a contrasty one; null until the pipeline saves its colors.
   */
  contrast: number | null;
}

/** A point of a photo, in percent across from the left and down from the top. */
export interface SpotlightFocus {
  x: number;
  y: number;
}

/** Where the photo was taken, written each way the menu's Script Display can choose. */
export type LocalizedLocation = Record<ScriptDisplay, PhotoLocation>;

/** Where the photo was taken, as the portfolio shows it. */
export interface PhotoLocation {
  /** "Places, City", or else "City, Country", or else the country. */
  label: string;
  /** The lines shown on hover: the GPS position, then the country when the label leaves it out. */
  details: string[];
  /** Each part on its own, so a view can pick how much to show; each is null when there's none. */
  parts: PhotoLocationParts;
}

/** The parts of where a photo was taken, written one way. */
export interface PhotoLocationParts {
  /** The most specific of its places, such as "Geunjeongmun Gate". */
  specific: string | null;
  /** Its places as a phrase, such as "In Gyeongbokgung Palace by Geunjeongmun Gate". */
  places: string | null;
  city: string | null;
  /** The state, province or prefecture, between the city and the country. */
  state: string | null;
  country: string | null;
  /** The GPS position, such as 37°31′21″ N, 126°58′46″ E. */
  gps: string | null;
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
  /** Whether the aperture was set on the lens by hand or isn't known, so the photo has none. */
  manualAperture: boolean;
}

/** A setting that's written with its value, such as "f/5.6". */
export type SettingKey = "aperture" | "exposure" | "iso" | "focalLength";

/** How each setting is written, in the order they're shown. */
export const SETTING_FORMATS: [SettingKey, (value: number | string) => string][] = [
  ["aperture", (value) => `f/${value}`],
  ["exposure", (value) => `${value}s`],
  ["iso", (value) => `ISO ${value}`],
  ["focalLength", (value) => `${value}mm`],
];

/** What a photo with a manual or unknown aperture shows for it. */
const MANUAL_APERTURE = "Manual/unknown aperture";

/** What shows for a setting the photo has no value for: only a manual aperture says so. */
function missingText(settings: CameraSettings, key: SettingKey): string | null {
  return key === "aperture" && settings.manualAperture ? MANUAL_APERTURE : null;
}

/** The setting as a photographer writes it, such as "f/5.6", or null when the photo has none. */
export function settingText(settings: CameraSettings, key: SettingKey): string | null {
  const value = settings[key];
  const write = SETTING_FORMATS.find(([name]) => name === key)![1];
  return value === null ? missingText(settings, key) : write(value);
}

/** The settings as a photographer writes them, such as "f/5.6", "1/60s", "ISO 400" and "18mm". */
export function settingsText(settings: CameraSettings): string[] {
  return SETTING_FORMATS.flatMap(([key]) => settingText(settings, key) ?? []);
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
  /** The photo's ID, unique among the photos; entries saved before IDs don't have it. */
  id?: number | null;
  file: string;
  /** The name to show, when one was written; older entries don't have it. */
  title?: string | null;
  /** A Markdown note about the photo, when one was written. */
  comment?: string | null;
  /** Entries saved before these were added don't have them. */
  aperture?: number | null;
  /** Whether the aperture is manual or unknown; entries saved before it was added don't have it. */
  manualAperture?: boolean;
  exposure?: string | null;
  iso?: number | null;
  focalLength?: number | null;
  camera: string | null;
  /** Entries saved before it was added don't have it. */
  lens?: string | null;
  gpsPosition: string | null;
  /** A GPS position written on the Photo page, "latitude, longitude" in decimal degrees, used instead of the EXIF one. */
  customGpsPosition?: string | null;
  createDate: string | null;
  /** When the photo went on the portfolio, an ISO time; null for a draft, and older entries don't have it. */
  addedDate?: string | null;
  /** When the photo was taken, written on the Photo page, used instead of the EXIF one; older entries don't have it. */
  customCreateDate?: string | null;
  /** A city, state and country written on the Photo page, shown instead of the EXIF ones; older entries don't have them. */
  customCity?: string | null;
  customState?: string | null;
  customCountry?: string | null;
  country: string | null;
  /** The state, province or prefecture from the EXIF, between the city and the country; older entries don't have it. */
  state?: string | null;
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
  /** The spots on the site the photo is spotlighted in, picked on Site Spotlight; older entries don't have them. */
  spotlightZones?: string[];
  /** The point kept in view when the photo is cropped to the other shape of screen; null or missing for the middle. */
  spotlightFocus?: SpotlightFocus | null;
  /** The places it was taken, from PLACES.json, each with how the photo relates to it; older entries don't have them. */
  places?: PhotoPlaces;
  /** The IDs of the photo's albums, tags and genres; older entries were saved without them. */
  albums?: string[];
  tags?: string[];
  genres?: string[];
  /** The photo's color summary, saved by the pipeline; older entries don't have it. */
  colors?: PhotoColorData | null;
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

/** The pipeline's "2026-10-25T04:10:22Z", or null when there's none or it can't be read. */
function parseAddedDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * One coordinate of exiftool's `37 deg 31' 21.06" N, 126 deg 58' 46.24" E`, in decimal degrees.
 * `hemispheres` lists the positive hemisphere first: "NS" for latitude, "EW" for longitude.
 */
function exifCoordinate(value: string, hemispheres: "NS" | "EW"): number | null {
  const number = String.raw`(\d+(?:\.\d+)?)`;
  const match = value.match(new RegExp(`${number} deg ${number}' ${number}" ([${hemispheres}])`));
  if (!match) return null;
  const [, deg, min, sec, hemisphere] = match;
  const degrees = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return hemisphere === hemispheres[0] ? degrees : -degrees;
}

/** One coordinate in decimal degrees, as a custom GPS position writes it, such as `-73.9634`. */
function decimalCoordinate(value: string): number | null {
  return /^\s*-?\d+(\.\d+)?\s*$/.test(value) ? Number(value) : null;
}

/** One coordinate, written in decimal degrees or as exiftool writes it. */
function parseCoordinate(value: string, hemispheres: "NS" | "EW"): number | null {
  return decimalCoordinate(value) ?? exifCoordinate(value, hemispheres);
}

/**
 * A GPS position as exiftool writes it, or as a custom one is written on the Photo page
 * ("40.7795, -73.9634"); both parts null when it can't be read.
 */
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

/** A GPS position from a place, and whether it's exactly where photos given the place were taken. */
type PlacePosition = Position & { exact: boolean };

const NO_PLACE_POSITION: PlacePosition = { ...NO_POSITION, exact: false };

/**
 * The place's own GPS position, exact when the place is marked as an exact location, or else the
 * nearest place above it that has one, which is never exact: the photo is only somewhere in it.
 */
function placePosition(id: string | undefined, passed = new Set<string>()): PlacePosition {
  const place = placeById(id);
  if (!place || passed.has(place.id)) return NO_PLACE_POSITION;
  const own = ownPosition(place);
  if (own) return { ...own, exact: place.exactLocation === true };
  return { ...placePosition(place.parent, passed.add(place.id)), exact: false };
}

/** The GPS position set on the place itself, if both parts are. */
function ownPosition({ latitude, longitude }: Place): Position | undefined {
  return latitude === undefined || longitude === undefined ? undefined : { latitude, longitude };
}

/** The photo's own GPS position: the custom one written on the Photo page, or else its EXIF one. */
function photoGps(photo: PhotoData): Position {
  const written = parseGpsPosition(photo.customGpsPosition ?? null);
  return written.latitude === null ? parseGpsPosition(photo.gpsPosition) : written;
}

/**
 * Where the photo goes on the map: its custom or EXIF GPS position, or else the first of its places (or a
 * place it's in) with a GPS position set on the Places page. A place's position is approximate
 * unless that place is marked as an exact location.
 */
function photoPosition(photo: PhotoData): Position & { approximatePosition: boolean } {
  const exif = photoGps(photo);
  if (exif.latitude !== null) return { ...exif, approximatePosition: false };
  const found = (photo.places ?? []).map(({ id }) => placePosition(id));
  const position = found.find(({ latitude }) => latitude !== null);
  if (!position) return { ...NO_POSITION, approximatePosition: false };
  const { exact, ...at } = position;
  return { ...at, approximatePosition: !exact };
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
  return { aperture, exposure, iso, focalLength, manualAperture: photo.manualAperture === true };
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

/** The photo's places, from PLACES.json, each with how the photo relates to it. */
type PhotoPlaces = { relation: string; id: string }[];

/**
 * One of the photo's places, with the word before it, such as "by Geunjeongmun Gate", or ", Queens"
 * for a comma.
 */
function placePart(word: string, name: Localized): Localized {
  return mapLocalized(name, (n, script) =>
    [word, n[script]].filter(Boolean).join(" ").replace(/^, /, ","),
  );
}

/** The parts after each other: a space between them, but none before a comma. */
function joinPlaceParts(parts: string[]): string {
  return parts.join(" ").replaceAll(" ,", ", ");
}

/** The word a place is joined to the place it's in with: its own, or else its parent's default, or else "in". */
function joinWord(place: Place): string {
  return place.parentRelation || placeById(place.parent)?.childRelation || "in";
}

/**
 * The word before the photo's place at `index`: when it's a place the place before it is in, the
 * word of the place just under it on the way up, as set on the Places page; else the photo's own.
 */
function wordBefore(places: PhotoPlaces, index: number): string {
  return placesWord(places, index) ?? places[index]?.relation ?? "";
}

/** The word from the Places page before the photo's place at `index`, if it's one the place before it is in. */
function placesWord(places: PhotoPlaces, index: number): string | undefined {
  const chain = chainBefore(places, index);
  const at = chain.findIndex((place) => place.id === places[index]?.id);
  return at > 0 ? chain.slice(at - 1, at).map(joinWord)[0] : undefined;
}

/** The photo's place before `index` and every place it's in; none for the first. */
function chainBefore(places: PhotoPlaces, index: number): Place[] {
  return index > 0 ? placeAncestry(places[index - 1]?.id) : [];
}

function capitalized(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The photo's places as a phrase, such as "In Gyeongbokgung Palace by Geunjeongmun Gate"; null
 * without any. Places missing from PLACES.json are left out. The old `placeName` isn't shown.
 */
function placeText(photo: PhotoData): Localized | null {
  const places = photo.places ?? [];
  const parts = places.flatMap(({ id }, index) => {
    const place = placeById(id);
    return place ? [placePart(wordBefore(places, index), localizePlace(place))] : [];
  });
  if (parts.length === 0) return null;
  return mapLocalized(parts, (p, script) =>
    capitalized(joinPlaceParts(p.map((part) => part[script]))),
  );
}

/** The most specific of the photo's places, the one inside the most others; null without any. */
function specificPlace(photo: PhotoData): Localized | null {
  const places = (photo.places ?? []).flatMap(({ id }) => placeAncestry(id).slice(0, 1));
  const deepest = places.toSorted(
    (a, b) => placeAncestry(b.id).length - placeAncestry(a.id).length,
  )[0];
  return deepest ? localizePlace(deepest) : null;
}

/** A city or country written each way, or null when there's none. */
function localizedField(type: "country" | "state" | "city", name: string | null): Localized | null {
  return name ? localizeName(type, name) : null;
}

/** The parts of where the photo was taken, each written every way. */
interface LocationParts {
  specific: Localized | null;
  place: Localized | null;
  city: Localized | null;
  state: Localized | null;
  country: Localized | null;
  gps: string | null;
}

/** Each part of where the photo was taken, written one way. */
function partsIn(parts: LocationParts, script: ScriptDisplay): PhotoLocationParts {
  const write = (part: Localized | null) => part?.[script] ?? null;
  return {
    specific: write(parts.specific),
    places: write(parts.place),
    city: write(parts.city),
    state: write(parts.state),
    country: write(parts.country),
    gps: parts.gps,
  };
}

/** Where the photo was taken, written one way: see photoLocation. */
function locationIn(parts: LocationParts, script: ScriptDisplay): PhotoLocation {
  const written = partsIn(parts, script);
  const { places, city, state, country } = written;
  const label = places ? joinParts(places, city) : joinParts(city, state, country);
  // The state and country go on hover only when the label leaves them out for the place.
  const details = [parts.gps, places ? state : null, places ? country : null];
  return { label, details: details.filter(Boolean) as string[], parts: written };
}

/**
 * Where the photo was taken, with a custom city and country over the EXIF ones: its places and
 * city, with the country on hover; or else its city and country; or else its country. Each is
 * written every Script Display way. Null without any of them, even when it has a GPS position.
 */
function photoLocation(photo: PhotoData): LocalizedLocation | null {
  const parts: LocationParts = {
    specific: specificPlace(photo),
    place: placeText(photo),
    ...cityAndState(photo),
    country: localizedField("country", custom(photo.customCountry, photo.country)),
    gps: gpsText(photoGps(photo)),
  };
  if (!hasLocation(parts)) return null;
  return Object.fromEntries(
    SCRIPT_DISPLAYS.map((script) => [script, locationIn(parts, script)]),
  ) as LocalizedLocation;
}

/**
 * The state, or null when it has the city's name too, such as Seoul in Seoul, so the name isn't
 * written twice.
 */
export function distinctState(state: string | null, city: string | null): string | null {
  return state && state.trim().toLowerCase() === city?.trim().toLowerCase() ? null : state;
}

/** The photo's custom or EXIF city and state, each written every way, leaving out a state named like the city. */
function cityAndState(photo: PhotoData) {
  const city = custom(photo.customCity, photo.city);
  const state = distinctState(custom(photo.customState, photo.state ?? null), city);
  return { city: localizedField("city", city), state: localizedField("state", state) };
}

/** Whether the photo has any place, city, state or country to show; a GPS position alone isn't one. */
function hasLocation(parts: LocationParts): boolean {
  return Boolean(parts.place || parts.city || parts.state || parts.country);
}

/** The IDs of the photo's places and every place they're in, each once, its own places first. */
function placeIdsOf(photo: PhotoData): string[] {
  const ids = (photo.places ?? []).flatMap(({ id }) => placeAncestry(id).map((place) => place.id));
  return [...new Set(ids)];
}

/** The city or country the first of the places (or a place they're in) that says one is in. */
function placeField(placeIds: string[], field: "city" | "state" | "country"): string | null {
  return placeIds.map((id) => placeById(id)?.[field]?.trim()).find(Boolean) ?? null;
}

/** The name a country, state or city goes by, rather than one of its other names; null stays null. */
function mainNameOf(type: "country" | "state" | "city", name: string | null): string | null {
  return name && mainName(type, name);
}

/** Where the photo was taken, as the location filter matches it: see Photo. */
function locationFields(photo: PhotoData) {
  const placeIds = placeIdsOf(photo);
  const field = (
    own: string | null | undefined,
    exif: string | null | undefined,
    key: "city" | "state" | "country",
  ) => mainNameOf(key, custom(own ?? null, exif ?? null) ?? placeField(placeIds, key));
  return {
    country: field(photo.customCountry, photo.country, "country"),
    state: field(photo.customState, photo.state, "state"),
    city: field(photo.customCity, photo.city, "city"),
    placeIds,
  };
}

/** The photo's albums, tags, genres, old spotlight place and focus point; older entries are missing them. */
function groupFields({
  albums = [],
  tags = [],
  genres = [],
  websiteSpotlight = null,
  spotlightFocus = null,
}: PhotoData) {
  return { albums, tags, genres, spotlightPlace: websiteSpotlight, spotlightFocus };
}

/**
 * Each entry's ID: its own, or else one after the highest any entry has, by its place in the list,
 * so every photo has a different one.
 */
function photoIds(data: PhotoData[]): number[] {
  const highest = Math.max(0, ...data.map(({ id }) => id ?? 0));
  return data.map(({ id }, index) => id ?? highest + index + 1);
}

/** The ALLPHOTOS.json entries the portfolio can place in time: ones with no custom or EXIF date are left out. */
function fromPhotoData(data: PhotoData[]): Photo[] {
  const ids = photoIds(data);
  return data.flatMap((photo, index) => {
    const takenAt = parseCreateDate(custom(photo.customCreateDate, photo.createDate));
    if (!takenAt) return [];
    return {
      id: ids[index] as number,
      title: photoTitle(photo),
      comment: photoComment(photo),
      settings: cameraSettings(photo),
      camera: photo.camera ?? "Unknown camera",
      lens: photo.lens ?? null,
      takenAt,
      addedAt: parseAddedDate(photo.addedDate),
      location: photoLocation(photo),
      ...photoPosition(photo),
      image: parseImage(photo),
      ...locationFields(photo),
      ...groupFields(photo),
      palette: photoColors(photo.colors),
      vividness: photoVividness(photo.colors),
      peakVividness: photoPeakVividness(photo.colors),
      lightness: photoLightness(photo.colors),
      contrast: photoContrast(photo.colors),
    };
  });
}

/** The photos, each with a city but no country given the country other photos in that city have. */
function withCityCountries(list: Photo[]): Photo[] {
  const countries = new Map(
    list.flatMap(({ city, country }) => (city && country ? [[city, country]] : [])),
  );
  return list.map((photo) =>
    photo.country || !photo.city ? photo : { ...photo, country: countries.get(photo.city) ?? null },
  );
}

const localPhotos = localData ? withCityCountries(fromPhotoData(localData)) : [];

/**
 * The photos in ALLPHOTOS.local.json when there are any (the photos in flight, locally), or else
 * the photos in data/photos/ALLPHOTOS.json, which the "Combine photo data" workflow builds.
 */
export const photos: Photo[] =
  localPhotos.length > 0
    ? localPhotos
    : withCityCountries(fromPhotoData(committedData as PhotoData[]));
