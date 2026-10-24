import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { type PendingSave, photoChanges } from "@/api/scan-changes";
import type { FieldChange } from "@/api/cameras";
import type { ColorAnalysis } from "@/api/exif";
import { requestJson } from "@/api/settings";

/** Base URLs to move the photos' image URLs between; both empty to only list the origins. */
export interface BaseUrlChange {
  from: string;
  to: string;
}

/** One scheme and host the photo files' image URLs point at. */
export interface ImageOrigin {
  origin: string;
  /** How many image URLs use it. */
  urls: number;
  /** How many photo files have at least one of them. */
  files: number;
}

/** One image URL the change rewrites. */
export interface UrlChange {
  /** Where the URL is in the photo's JSON, such as `images.medium`. */
  field: string;
  from: string;
  to: string;
}

/** Where an Update Data preview read the photo files, as the next Commit will have them. */
export interface ScannedPhotos {
  repo: string;
  folder: string;
  /** Where the files were read: the photo data pull request's branch, or the base branch. */
  branch: string;
  /** The open photo data pull request the change goes to; null when a new one would be opened. */
  pullRequest: { number: number; url: string } | null;
  /** How many photo files were read. */
  photoFiles: number;
  /** Photo files that couldn't be read; while there are any, nothing can be changed. */
  unreadable: { path: string; error: string }[];
}

export interface BaseUrlPreview extends ScannedPhotos {
  /** The base URLs as the backend cleaned them up; empty when not given. */
  from: string;
  to: string;
  /** Most used first. */
  origins: ImageOrigin[];
  /** The photo files with an image URL under `from`. */
  files: { path: string; fileUrl: string; changes: UrlChange[] }[];
  /** How many URLs change. */
  urls: number;
}

export interface BaseUrlResult extends PendingSave {
  files: number;
  urls: number;
}

function post<T>(url: string, body: unknown) {
  return requestJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Reads every photo JSON file and previews moving their image URLs from one base URL to another. */
export const baseUrlPreviewQuery = (change: BaseUrlChange) =>
  queryOptions({
    queryKey: ["data", "image-base-url", change],
    queryFn: () => post<BaseUrlPreview>("/api/data/image-base-url/preview", change),
    retry: false,
    refetchOnWindowFocus: false,
  });

/** Moves the image URLs in every photo JSON file, as changes waiting for Commit. */
export const replaceBaseUrlMutation = mutationOptions({
  mutationKey: ["data", "image-base-url", "replace"],
  meta: { saves: true, changes: (result) => photoChanges(result as BaseUrlResult) },
  mutationFn: (change: BaseUrlChange) => post<BaseUrlResult>("/api/data/image-base-url", change),
});

/** A field a photo file is missing, with the value it gets. */
export interface AddedField {
  /** Such as `aperture`, or `images.thumbnail` for a nested one. */
  field: string;
  value: unknown;
  /** True when the value was read from the photo's original in R2, not the field's default. */
  fromExif: boolean;
  /** True when the value is the Square Thumbnail's crop, read from its URL's ?crop= mark or from R2. */
  fromThumbnail: boolean;
  /** True when the value is the photo's new ID, counted in the order the photo files were created. */
  numbered: boolean;
}

export interface MissingFieldsPreview extends ScannedPhotos {
  /** Each missing field with how many files miss it, in the order new photo files list them. */
  fields: {
    field: string;
    files: number;
    fromExif: number;
    fromThumbnail: number;
    numbered: number;
  }[];
  files: {
    path: string;
    fileUrl: string;
    added: AddedField[];
    /** Why the photo's EXIF couldn't be read, so its EXIF fields get their defaults. */
    exifError?: string;
    /** Why the Square Thumbnail's crop couldn't be read from R2, so it gets its default. */
    cropError?: string;
  }[];
  /** True when missing EXIF fields were read from the originals in R2. */
  readExif: boolean;
}

export interface MissingFieldsResult extends PendingSave {
  files: number;
  /** How many fields were added, across the files. */
  fields: number;
}

/** Reads every photo JSON file and lists the fields each is missing compared with a new one. */
export const missingFieldsQuery = (readExif: boolean) =>
  queryOptions({
    queryKey: ["data", "missing-fields", readExif],
    queryFn: () => post<MissingFieldsPreview>("/api/data/missing-fields/preview", { readExif }),
    retry: false,
    refetchOnWindowFocus: false,
  });

/** Adds the missing fields to every photo JSON file, as changes waiting for Commit. */
export const addMissingFieldsMutation = mutationOptions({
  mutationKey: ["data", "missing-fields", "add"],
  meta: { saves: true, changes: (result) => photoChanges(result as MissingFieldsResult) },
  mutationFn: (readExif: boolean) =>
    post<MissingFieldsResult>("/api/data/missing-fields", { readExif }),
});

/** A photo file that gets a color summary, read from its original in R2. */
export interface ColorFile {
  path: string;
  fileUrl: string;
  /** True when the file already has colors, which these replace. */
  replaces: boolean;
  /** The photo's colors; null when `error` says why they couldn't be read, and the file is left as it is. */
  colors: ColorAnalysis | null;
  error?: string;
}

export interface ColorsPreview extends ScannedPhotos {
  /** How many photo files already have colors. */
  haveColors: number;
  /** True when photos that already have colors get them again. */
  recompute: boolean;
  files: ColorFile[];
}

export interface ColorsResult extends PendingSave {
  files: number;
  /** How many photos' colors couldn't be read, so their files were left as they are. */
  failed: number;
}

/** Reads the colors of every photo without them (or every photo, to recompute) from its original in R2. */
export const colorsPreviewQuery = (recompute: boolean) =>
  queryOptions({
    queryKey: ["data", "colors", recompute],
    queryFn: () => post<ColorsPreview>("/api/data/colors/preview", { recompute }),
    retry: false,
    refetchOnWindowFocus: false,
  });

/** Saves those colors in each photo JSON file, as changes waiting for Commit. */
export const writeColorsMutation = mutationOptions({
  mutationKey: ["data", "colors", "write"],
  meta: { saves: true, changes: (result) => photoChanges(result as ColorsResult) },
  mutationFn: (recompute: boolean) => post<ColorsResult>("/api/data/colors", { recompute }),
});

/** A photo or place file whose countries or cities are written as the name that wins over them. */
interface LocationNameFile {
  path: string;
  fileUrl?: string;
  kind: "photo" | "place";
  changes: FieldChange[];
}

/** What writing every country and city as the name that wins over it would change. */
interface LocationNamesPreview extends ScannedPhotos {
  /** How many place files were read. */
  placeFiles: number;
  /** How many other names the countries and cities have. */
  otherNames: number;
  files: LocationNameFile[];
}

interface LocationNamesResult extends PendingSave {
  files: number;
  fields: number;
}

/** The photo and place files a location names save changed, as changes over the combined lists. */
function locationChanges(result: LocationNamesResult) {
  return result.changes.map((change) => ({
    kind: change.path.includes("/places/") ? ("places" as const) : ("photos" as const),
    ...change,
  }));
}

/** Reads every photo and place file and lists the countries and cities that are another name of one. */
export const locationNamesPreviewQuery = queryOptions({
  queryKey: ["data", "location-names"],
  queryFn: () => post<LocationNamesPreview>("/api/data/location-names/preview", {}),
  retry: false,
  refetchOnWindowFocus: false,
  staleTime: 0,
});

/** Writes each of those as the name that wins over it, as changes waiting for Commit. */
export const applyLocationNamesMutation = mutationOptions({
  mutationKey: ["data", "location-names", "apply"],
  meta: { saves: true, changes: (result) => locationChanges(result as LocationNamesResult) },
  mutationFn: () => post<LocationNamesResult>("/api/data/location-names", {}),
});
