import {
  type Clock,
  type ShiftSide,
  type ShiftZones,
  clockFromPhoto,
  photoZone,
} from "@/lib/timezone-shift";
import type { DayPhoto } from "@/lib/timezone-shift-plan";

/**
 * What the camera's clock was set to that session: the start or end timezone, another one, or not
 * known, worked out from one photo whose real local time you know.
 */
export type ClockSetting =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "zone"; zone: string }
  | {
      kind: "match";
      /** The path of the photo whose real time is known. */
      path: string;
      /** Its real local time, as exiftool writes dates, or "" until it's written. */
      realTime: string;
    };

/** What the clock starts as: the start timezone, as a camera that kept home time. */
export const DEFAULT_CLOCK: ClockSetting = { kind: "start" };

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
function matchedClock(setting: Extract<ClockSetting, { kind: "match" }>, context: ClockContext) {
  const photo = context.photos.find((day) => day.photo.file.path === setting.path);
  if (!photo) return null;
  const zone = photoZone(knownSide(context.sides[setting.path]), context.zones);
  return clockFromPhoto(photo.clockTime, setting.realTime, zone);
}

/** The timezone a clock set to the start, end or another timezone kept. */
function zoneOf(
  setting: Extract<ClockSetting, { kind: "start" | "end" | "zone" }>,
  zones: ShiftZones,
) {
  return setting.kind === "zone" ? setting.zone : zones[setting.kind];
}

/**
 * The clock the camera kept, or null when it can't be worked out yet, such as before the real time
 * of the photo is written.
 */
export function resolveClock(setting: ClockSetting, context: ClockContext): Clock | null {
  if (setting.kind === "match") return matchedClock(setting, context);
  return { zone: zoneOf(setting, context.zones) };
}
