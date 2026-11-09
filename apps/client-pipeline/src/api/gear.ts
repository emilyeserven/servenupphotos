import { mutationOptions } from "@tanstack/react-query";
import type { GearBox, GearCrop, GearFile, GearKind } from "@portfolio/lib/gear-pictures";
import { settingEntries, settingMutations } from "@/api/data-files";
import { entryId } from "@/api/places";
import { requestJson } from "@/api/request";
import type { CombinedPhoto } from "@/lib/group-photos";

function isGearFile(value: unknown): value is GearFile {
  const file = value as Partial<GearFile> | null;
  return typeof file?.id === "string" && typeof file.name === "string";
}

/** The gear pictures as the next Commit will have them: GEAR.json with the changes since. */
export const gearFiles = settingEntries("gear", isGearFile);

/** The ID a camera's or lens's picture file gets, such as `camera-fujifilm-x-t5`. */
export function gearId(kind: GearKind, name: string): string {
  return `${kind}-${entryId(name)}`.slice(0, 100).replace(/-+$/, "");
}

/** One camera or lens on the Gear Pictures page: its name, how many photos have it, and its picture file. */
export interface GearRow {
  kind: GearKind;
  name: string;
  photos: number;
  file?: GearFile;
}

/** How many photos name each camera or lens, by name. */
function namesOf(photos: CombinedPhoto[], kind: GearKind): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of photos.flatMap((photo) => nameOf(photo, kind))) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/** The camera or lens a photo names, or none. */
function nameOf(photo: CombinedPhoto, kind: GearKind): string[] {
  const name = photo[kind];
  return typeof name === "string" && name.trim() !== "" ? [name] : [];
}

/**
 * Every camera or lens the photos name, most photos first, each with its picture file, then the
 * picture files for ones no photo names any more.
 */
export function gearRows(photos: CombinedPhoto[], files: GearFile[], kind: GearKind): GearRow[] {
  const ofKind = files.filter((file) => file.kind === kind);
  const fileFor = (name: string) =>
    ofKind.find((file) => file.name.toLowerCase() === name.toLowerCase());
  const named = [...namesOf(photos, kind)]
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]): GearRow => ({ kind, name, photos: count, file: fileFor(name) }));
  const left = ofKind
    .filter((file) => !named.some((row) => row.file === file))
    .map((file): GearRow => ({ kind, name: file.name, photos: 0, file }));
  return [...named, ...left];
}

/** Where a gear picture or its crop went in R2. */
interface UploadedGearImage {
  key: string;
  url: string;
}

/** Where an original gear picture went in R2, its size upright, in pixels, and where the gear is in it. */
export interface UploadedGearOriginal extends UploadedGearImage {
  width: number;
  height: number;
  /** The box around what isn't plain background: the product on a store page's white. */
  subject: GearBox;
}

/** Puts a picture in R2 right away, unchanged, for a crop to be cut from, and finds the gear in it. */
export const uploadGearImageMutation = mutationOptions({
  mutationKey: ["gear", "image"],
  mutationFn: (image: File) => {
    const body = new FormData();
    body.append("image", image);
    return requestJson<UploadedGearOriginal>("/api/gear/image", { method: "POST", body });
  },
});

/** What to crop: the original picture's link in R2 and the part of it to keep. */
interface GearCropRequest {
  original: string;
  crop: GearCrop;
}

/** Cuts a 200px-tall crop out of an original gear picture and puts it in R2 right away. */
export const cropGearImageMutation = mutationOptions({
  mutationKey: ["gear", "crop"],
  mutationFn: (request: GearCropRequest) =>
    requestJson<UploadedGearImage>("/api/gear/crop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }),
});

const gearMutations = settingMutations<GearFile>("gear");

/** Saves a camera's or lens's picture file, new or changed, as a change waiting for Commit. */
export const saveGearMutation = gearMutations.save;

/** Removes a camera's or lens's picture file, as a change waiting for Commit. */
export const deleteGearMutation = gearMutations.remove;
