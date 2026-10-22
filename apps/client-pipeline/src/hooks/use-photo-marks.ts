import { useMemo } from "react";
import type { BucketImage, InFlightResponse } from "@/api/photos";
import { versionKeys } from "@/api/versions";
import { useInFlight } from "@/hooks/use-in-flight";
import { useCombinedData } from "@/stores/combined-data";

/** The images whose photo data is in the open pull request, and that pull request's number. */
interface InFlightImages {
  keys: Set<string>;
  pullRequestNumber?: number;
}

/** Whether each bucket image's photo is in flight or in ALLPHOTOS.json. */
export interface PhotoMarks {
  inFlight: InFlightImages;
  /** Keys of the images whose photo is in ALLPHOTOS.json, with their resized versions. */
  published: Set<string>;
  /** Whether both checks worked, so a photo in neither can have its JSON generated. */
  checked: boolean;
  /** Why a check failed, when one did. */
  problem?: Error;
}

/**
 * Marks the bucket's images from Photos in Flight's data and ALLPHOTOS.json on the base branch and
 * in the pull request. Nothing is marked or checked when GitHub isn't set up.
 */
export function usePhotoMarks(
  githubIsSetUp: boolean,
  bucket?: { images: BucketImage[] },
): PhotoMarks {
  const inFlight = useInFlight(githubIsSetUp);
  const combined = useCombinedData(githubIsSetUp);
  const marked = useMemo(
    () => ({
      inFlight: inFlightImages(inFlight.data),
      published: publishedImages(imagesOf(bucket), [
        ...entriesOf(combined.data?.base.photos.data),
        ...entriesOf(combined.data?.head?.photos.data),
      ]),
    }),
    [bucket, inFlight.data, combined.data],
  );
  return {
    ...marked,
    checked: inFlight.isSuccess && combined.data !== undefined,
    problem: inFlight.error ?? (combined.data ? undefined : combined.error),
  };
}

function imagesOf(bucket?: { images: BucketImage[] }): BucketImage[] {
  return bucket?.images ?? [];
}

function entriesOf(data: unknown[] | undefined): unknown[] {
  return data ?? [];
}

/**
 * R2 keys from the images matched in R2 and the keys saved with the photo data, plus each one's
 * resized versions.
 */
function inFlightImages(data?: InFlightResponse): InFlightImages {
  if (!data?.pullRequest) return { keys: new Set() };
  const matched = Object.values(data.images.byPath).map((image) => image.key);
  const saved = data.files.flatMap((file) => (file.imageKey ? [file.imageKey] : []));
  const originals = [...matched, ...saved];
  const keys = new Set([...originals, ...originals.flatMap(versionKeys)]);
  return { keys, pullRequestNumber: data.pullRequest.number };
}

/** What an ALLPHOTOS.json entry says about its image, when it says anything. */
interface SavedImage {
  file?: string;
  url?: string;
  key?: string;
}

function savedImage(entry: unknown): SavedImage {
  const photo = (entry ?? {}) as { file?: unknown; images?: { full?: unknown; key?: unknown } };
  return {
    file: stringOrUndefined(photo.file),
    url: stringOrUndefined(photo.images?.full),
    key: stringOrUndefined(photo.images?.key),
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Keys of the images whose photo is an ALLPHOTOS.json entry, plus each one's resized versions. An
 * entry is matched by its saved R2 key, then its R2 URL, then, for one saved without either, the
 * name stem its file name would get in a key, as Photos in Flight matches photos.
 */
function publishedImages(images: BucketImage[], entries: unknown[]): Set<string> {
  const keys = entries.flatMap((entry) => matchingKeys(images, savedImage(entry)));
  return new Set([...keys, ...keys.flatMap(versionKeys)]);
}

function matchingKeys(images: BucketImage[], saved: SavedImage): string[] {
  if (saved.key) return [saved.key];
  if (saved.url) return images.filter((image) => image.url === saved.url).map((i) => i.key);
  return saved.file ? keysByStem(images, nameStem(saved.file)) : [];
}

/** Keys of the uploaded originals whose key carries stem. */
function keysByStem(images: BucketImage[], stem: string): string[] {
  if (!stem) return [];
  return images.filter((image) => ORIGINAL_KEY.exec(image.key)?.[1] === stem).map((i) => i.key);
}

/** The name stem in an uploaded original's key, such as dsc0001 in photos/<hash>-dsc0001.jpg. */
const ORIGINAL_KEY = /^photos\/[0-9a-f]{12}-([a-z0-9-]+)\.jpg$/;

/** The key stem UploadPhoto gives a photo's name, as the backend's keyStem does. */
function nameStem(file: string): string {
  const base = file.replaceAll("\\", "/").split("/").pop() ?? "";
  const stem = base
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return stem.slice(0, 60).replace(/-+$/, "");
}
