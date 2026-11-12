import committedData from "@portfolio/data/photos/ALLPHOTOS.json";
import type { Group } from "@portfolio/lib/groups";
import {
  type ColorShare,
  type PhotoColorData,
  photoAverageColor,
  photoColors,
  photoContrast,
  photoLightness,
  photoPeakVividness,
  photoVividness,
} from "@portfolio/lib/photo-colors";
import { parseAddedDate, parseCreateDate } from "@portfolio/lib/photo-dates";
import { photoPosition } from "@portfolio/lib/photo-gps";
import { parseImage, type PhotoImage, type PhotoImages } from "@portfolio/lib/photo-image";
import {
  custom,
  type LocalizedLocation,
  locationFields,
  type PhotoPlaces,
  photoLocation,
  withCityCountries,
} from "@portfolio/lib/photo-places";
import { type CameraSettings, cameraSettings } from "@portfolio/lib/photo-settings";
import { withSmartAlbums } from "@portfolio/lib/smart-albums";
import {
  type OriginalCrop,
  type OriginalEntry,
  publicOriginal,
} from "@portfolio/lib/unedited-original";
import { relatedPhotos, type RelatedPhoto } from "@portfolio/lib/related-photos";
import type { TimelineLabel } from "@portfolio/lib/timeline-labels";

export type { PhotoImage } from "@portfolio/lib/photo-image";
export type {
  LocalizedLocation,
  PhotoLocation,
  PhotoLocationParts,
} from "@portfolio/lib/photo-places";

export interface Photo {
  /**
   * The photo's ID from its JSON file, which links to it use, such as `/grid?photo=12`. A photo
   * saved before IDs gets one after the highest, by its place in ALLPHOTOS.json, until Update Data
   * gives it its own; that one can change when photos are added.
   */
  id: number;
  title: string;
  /**
   * What the photo shows, for screen readers and for when it can't load: the alt text written in the
   * pipeline, or else the title.
   */
  alt: string;
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
   * The resized versions of its unedited original, for the Raw vs Edited page; null unless one was
   * uploaded in the pipeline and marked to show on the portfolio.
   */
  original: OriginalImage | null;
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
  /**
   * The photos its More like this drawer shows, in order: the ones picked by hand, with their
   * notes, then the ones the pipeline found, each once. Empty until the pipeline has found any.
   */
  related: RelatedPhoto[];
  /** The IDs of the photographic genres it's in, such as "street"; empty for older entries. */
  genres: string[];
  /** The point of the photo kept in view when the screen is the other way round, set on its Photo page; null keeps the middle. */
  spotlightFocus: SpotlightFocus | null;
  /** Where on the screen the focus point goes, in percent across and down, set on its Photo page; null for the middle. */
  spotlightPlacement: SpotlightFocus | null;
  /**
   * Its own focus point and placement for each spotlight zone, by zone ID, set on the pipeline's
   * Site Spotlight page; a zone left out uses spotlightFocus and spotlightPlacement.
   */
  zoneFocus: Record<string, ZoneFocus>;
  /**
   * How its colors split between the 12 hue buckets and the shades from black to white, biggest
   * first; empty until the pipeline saves its colors.
   */
  palette: ColorShare[];
  /** Its average color as a hex string, such as "#514d48"; null until the pipeline saves its colors. */
  averageColor: string | null;
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

/** A photo's unedited original as a view draws it: its resized versions, and the part the edit shows. */
export type OriginalImage = PhotoImage & { crop: OriginalCrop | null };

/** A point of a photo, in percent across from the left and down from the top. */
export interface SpotlightFocus {
  x: number;
  y: number;
}

/** A photo's focus point and placement in one spotlight zone; null for the middle. */
export interface ZoneFocus {
  focus: SpotlightFocus | null;
  placement: SpotlightFocus | null;
}

/** One entry of ALLPHOTOS.json: a photo's file name and sanitized EXIF, as the pipeline saves it. */
export interface PhotoEntry {
  /** The photo's ID, unique among the photos; entries saved before IDs don't have it. */
  id?: number | null;
  file: string;
  /** The name to show, when one was written; older entries don't have it. */
  title?: string | null;
  /** A Markdown note about the photo, when one was written. */
  comment?: string | null;
  /** A short description of what the photo shows, when one was written; older entries don't have it. */
  altText?: string | null;
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
  images: PhotoImages;
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
  /** Where on the screen the focus point goes; null or missing for the middle. */
  spotlightPlacement?: SpotlightFocus | null;
  /**
   * The focus point and placement for each spotlight zone, by zone ID, set on Site Spotlight; a
   * zone left out, or the whole field missing, uses spotlightFocus and spotlightPlacement.
   */
  spotlightZoneFocus?: Record<string, Partial<ZoneFocus>>;
  /** The places it was taken, from PLACES.json, each with how the photo relates to it; older entries don't have them. */
  places?: PhotoPlaces;
  /** The IDs of the photo's albums, tags and genres; older entries were saved without them. */
  albums?: string[];
  tags?: string[];
  genres?: string[];
  /** The photo's color summary, saved by the pipeline; older entries don't have it. */
  colors?: PhotoColorData | null;
  /** The IDs of the photos picked by hand on the pipeline's Related Photos page, shown first in More like this. */
  pickedSimilar?: number[];
  /** The note shown beside each hand-picked photo in More like this, by its ID. */
  pickedSimilarNotes?: Record<string, string>;
  /** The IDs of the photos most like it, best first, as the pipeline's Find Related Photos saved them. */
  similarPhotos?: number[];
  /** Its unedited original, uploaded on the pipeline's Photo page; most entries don't have one. */
  original?: OriginalEntry | null;
  /** The areas pixelated on its versions, which a shown original's must match; left out when none are. */
  faces?: unknown[];
}

// ALLPHOTOS.local.json is made by `pnpm photos:local` (which `pnpm dev` runs) and git-ignored, so
// it's only there locally. A glob, unlike an import, doesn't fail when the file is missing.
const localData = Object.values(
  import.meta.glob<PhotoEntry[]>("../data/photos/ALLPHOTOS.local.json", {
    eager: true,
    import: "default",
  }),
)[0];

/** The title written on the Photo page, or else the file name without its extension. */
function photoTitle(photo: PhotoEntry): string {
  return photo.title?.trim() || photo.file.replace(/\.[^.]*$/, "");
}

/** The alt text written in the pipeline, or else the photo's title. */
function photoAlt(photo: PhotoEntry): string {
  return photo.altText?.trim() || photoTitle(photo);
}

/** The resized versions of its unedited original, when it's shown on the portfolio. */
function originalImage(photo: PhotoEntry): OriginalImage | null {
  const original = publicOriginal(photo);
  const image = original && parseImage(original);
  return image ? { ...image, crop: original.crop ?? null } : null;
}

/** The Markdown comment written on the Photo page, or null without one. */
function photoComment(photo: PhotoEntry): string | null {
  return photo.comment?.trim() || null;
}

/** The photo's albums, tags, genres, old spotlight place, focus points and their placements; older entries are missing them. */
function groupFields({
  albums = [],
  tags = [],
  genres = [],
  websiteSpotlight = null,
  spotlightFocus = null,
  spotlightPlacement = null,
  spotlightZoneFocus = {},
  ...related
}: PhotoEntry) {
  return {
    albums,
    tags,
    related: relatedPhotos(related),
    genres,
    spotlightPlace: websiteSpotlight,
    spotlightFocus,
    spotlightPlacement,
    zoneFocus: zoneFocuses(spotlightZoneFocus),
  };
}

/** Each zone's focus point and placement, with a missing one as the middle. */
function zoneFocuses(raw: Record<string, Partial<ZoneFocus>>): Record<string, ZoneFocus> {
  return Object.fromEntries(
    Object.entries(raw).map(([zone, { focus = null, placement = null }]) => [
      zone,
      { focus, placement },
    ]),
  );
}

/**
 * Each entry's ID: its own, or else one after the highest any entry has, by its place in the list,
 * so every photo has a different one.
 */
function photoIds(data: PhotoEntry[]): number[] {
  const highest = Math.max(0, ...data.map(({ id }) => id ?? 0));
  return data.map(({ id }, index) => id ?? highest + index + 1);
}

/** The ALLPHOTOS.json entries the portfolio can place in time: ones with no custom or EXIF date are left out. */
function fromPhotoData(data: PhotoEntry[]): Photo[] {
  const ids = photoIds(data);
  return data.flatMap((photo, index) => {
    const takenAt = parseCreateDate(custom(photo.customCreateDate, photo.createDate));
    if (!takenAt) return [];
    return {
      id: ids[index] as number,
      title: photoTitle(photo),
      alt: photoAlt(photo),
      comment: photoComment(photo),
      settings: cameraSettings(photo),
      camera: photo.camera ?? "Unknown camera",
      lens: photo.lens ?? null,
      takenAt,
      addedAt: parseAddedDate(photo.addedDate),
      location: photoLocation(photo),
      ...photoPosition(photo),
      image: parseImage(photo),
      original: originalImage(photo),
      ...locationFields(photo),
      ...groupFields(photo),
      palette: photoColors(photo.colors),
      averageColor: photoAverageColor(photo.colors),
      vividness: photoVividness(photo.colors),
      peakVividness: photoPeakVividness(photo.colors),
      lightness: photoLightness(photo.colors),
      contrast: photoContrast(photo.colors),
    };
  });
}

/**
 * Photo JSON entries as the portfolio reads them, leaving out the ones with no date, each in the
 * Smart Albums its rules match too. The pipeline's Gallery reads its photos this way so the
 * portfolio's filters can narrow them, and its album pages pass the albums and timeline labels on
 * GitHub, which may be newer than the portfolio's own.
 */
export function photosFromData(
  data: PhotoEntry[],
  albums?: Group[],
  labels?: TimelineLabel[],
): Photo[] {
  return withSmartAlbums(withCityCountries(fromPhotoData(data)), albums, labels);
}

const localPhotos = localData ? photosFromData(localData) : [];

/**
 * The photos in ALLPHOTOS.local.json when there are any (the photos in flight, locally), or else
 * the photos in data/photos/ALLPHOTOS.json, which the "Combine photo data" workflow builds.
 */
export const photos: Photo[] =
  localPhotos.length > 0 ? localPhotos : photosFromData(committedData as PhotoEntry[]);
