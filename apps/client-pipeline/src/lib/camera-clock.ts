import {
  type Clock,
  type ShiftSide,
  type ShiftZones,
  clockFromPhoto,
  photoZone,
} from "@/lib/timezone-shift";
import type { DayPhoto } from "@/lib/timezone-shift-plan";

/**
 * What one camera's clock was set to on the day: the start or end timezone, another one, the local
 * time wherever it was (as a phone keeps it), or not known, worked out from one photo whose real
 * local time you know.
 */
export type CameraClock =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "zone"; zone: string }
  | { kind: "right" }
  | {
      kind: "match";
      /** The path of the photo whose real time is known. */
      path: string;
      /** Its real local time, as exiftool writes dates, or "" until it's written. */
      realTime: string;
    };

/** What a camera's clock starts as: the start timezone, as a camera that kept home time. */
export const DEFAULT_CLOCK: CameraClock = { kind: "start" };

/** What a photo without a camera in its EXIF is grouped under. */
const NO_CAMERA = "Unknown camera";

/** The camera the photo was taken with, as its EXIF names it. */
function cameraOf(day: DayPhoto): string {
  const camera = day.photo.data.camera;
  return typeof camera === "string" && camera.trim() ? camera.trim() : NO_CAMERA;
}

/** The photos by camera, each camera's in the order its clock took them, cameras by first photo. */
export function byCamera(photos: DayPhoto[]): [string, DayPhoto[]][] {
  const groups = new Map<string, DayPhoto[]>();
  for (const day of photos.toSorted((a, b) => a.clockTime.localeCompare(b.clockTime))) {
    groups.set(cameraOf(day), [...(groups.get(cameraOf(day)) ?? []), day]);
  }
  return [...groups];
}

/** What a clock is worked out from: the day's two timezones, its photos and their sides. */
interface ClockContext {
  zones: ShiftZones;
  photos: DayPhoto[];
  sides: Record<string, ShiftSide>;
}

/** The side a photo of known time was on; one left out counts as before. */
function knownSide(side: ShiftSide | undefined): Exclude<ShiftSide, "skip"> {
  return side === "after" ? "after" : "before";
}

/** The clock worked out from the photo whose real time is known; null until it's written. */
function matchedClock(setting: Extract<CameraClock, { kind: "match" }>, context: ClockContext) {
  const photo = context.photos.find((day) => day.photo.file.path === setting.path);
  if (!photo) return null;
  const zone = photoZone(knownSide(context.sides[setting.path]), context.zones);
  return clockFromPhoto(photo.clockTime, setting.realTime, zone);
}

/** The timezone a clock set to the start, end or another timezone kept. */
function zoneOf(
  setting: Extract<CameraClock, { kind: "start" | "end" | "zone" }>,
  zones: ShiftZones,
) {
  return setting.kind === "zone" ? setting.zone : zones[setting.kind];
}

/**
 * The clock the camera kept, or null when its photos need no fix (its clock was right) or it can't
 * be worked out yet, such as before the real time of its photo is written.
 */
export function resolveClock(setting: CameraClock, context: ClockContext): Clock | null {
  if (setting.kind === "right") return null;
  if (setting.kind === "match") return matchedClock(setting, context);
  return { zone: zoneOf(setting, context.zones) };
}
