/**
 * Fixing the times of photos taken on a day that crossed timezones. A camera keeps one clock, so
 * after a flight its photos carry the time back home; this works out the local time where each
 * photo was taken, as exiftool writes dates ("2016:12:23 22:07:39").
 */

/** Which side of the timezone change a photo was taken on, or "skip" to leave it as it is. */
export type ShiftSide = "before" | "after" | "skip";

/** Which timezone the camera's clock was set to that day. */
export type ClockZone = "start" | "end";

/** The timezones of a day that crossed them, as IANA names such as "Asia/Tokyo". */
export interface ShiftZones {
  /** Where the day started. */
  start: string;
  /** Where the day ended. */
  end: string;
  /** Which of the two the camera's clock was set to. */
  clock: ClockZone;
}

const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/;

/** The date and time as milliseconds, read as if it were UTC; null when it isn't an exiftool date. */
function wallMillis(date: string): number | null {
  const match = EXIF_DATE.exec(date);
  return match ? Date.parse(isoOf(match)) : null;
}

/** A matched exiftool date as an ISO date read as UTC, such as "2016-12-23T22:07:39Z". */
function isoOf([, year, month, day, hour, minute, second]: RegExpExecArray): string {
  return `${year}-${month}-${day}T${hour}:${minute}:${second || "00"}Z`;
}

/** Milliseconds read as if they were UTC, written as exiftool writes dates. */
function exifFromWall(millis: number): string {
  const iso = new Date(millis).toISOString();
  return `${iso.slice(0, 10).replaceAll("-", ":")} ${iso.slice(11, 19)}`;
}

/** Formats an instant as the wall clock in a timezone reads it, by its parts. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  const known = formatters.get(zone);
  if (known) return known;
  const made = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatters.set(zone, made);
  return made;
}

/** How far the timezone's clocks are ahead of UTC at the instant, in milliseconds. */
function offsetAt(instant: number, zone: string): number {
  const parts = Object.fromEntries(
    formatterFor(zone)
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  const { year, month, day, hour, minute, second } = parts;
  const wall = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant a wall clock in the timezone read `wall` (milliseconds read as UTC). Checked twice,
 * so a time near a daylight saving change lands on the offset in force then.
 */
function instantOf(wall: number, zone: string): number {
  const guess = wall - offsetAt(wall, zone);
  return wall - offsetAt(guess, zone);
}

/** Whether the name is a timezone this browser knows. */
function isZone(zone: string): boolean {
  try {
    formatterFor(zone);
    return true;
  } catch {
    return false;
  }
}

/** Whether every one of the names is a timezone this browser knows. */
function allKnown(...zones: string[]): boolean {
  return zones.every(isZone);
}

/** The timezone the camera's clock was set to. */
function clockZoneOf(zones: ShiftZones): string {
  return zones.clock === "start" ? zones.start : zones.end;
}

/** Which timezone a photo was taken in: the start one before the change, the end one after. */
function photoZone(side: Exclude<ShiftSide, "skip">, zones: ShiftZones): string {
  return side === "before" ? zones.start : zones.end;
}

/**
 * The local time where the photo was taken, as exiftool writes dates, from what the camera's clock
 * read; null when the clock time isn't a date or a timezone isn't known.
 */
export function shiftedTime(
  clockTime: string,
  side: Exclude<ShiftSide, "skip">,
  zones: ShiftZones,
): string | null {
  const wall = wallMillis(clockTime);
  const clockZone = clockZoneOf(zones);
  const zone = photoZone(side, zones);
  if (wall === null || !allKnown(clockZone, zone)) return null;
  const instant = instantOf(wall, clockZone);
  return exifFromWall(instant + offsetAt(instant, zone));
}

/** How far apart two exiftool dates are, in minutes (later minus earlier); 0 when either isn't one. */
export function minutesBetween(from: string, to: string): number {
  const a = wallMillis(from);
  const b = wallMillis(to);
  return a === null || b === null ? 0 : Math.round((b - a) / 60_000);
}

/** A shift in minutes as it reads, such as "+8 h", "−3 h 30 min" or "No change". */
export function readableShift(minutes: number): string {
  if (minutes === 0) return "No change";
  return `${signOf(minutes)}${duration(Math.abs(minutes))}`;
}

/** "+" for a number above 0, else "−". */
function signOf(minutes: number): string {
  return minutes > 0 ? "+" : "−";
}

/** A number of minutes above 0 as it reads, such as "3 h 30 min". */
function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours} h` : "", rest ? `${rest} min` : ""].filter(Boolean).join(" ");
}

/** The day part of an exiftool date ("2016-12-23"), or "" when it isn't one. */
export function dayOf(date: string): string {
  const match = EXIF_DATE.exec(date);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

/** A day ("2016-12-23") as it reads, such as "Fri, Dec 23, 2016". */
export function readableDay(day: string): string {
  const millis = wallMillis(`${day.replaceAll("-", ":")} 00:00:00`);
  if (millis === null) return day;
  return new Date(millis).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** An exiftool date's time of day as it reads, such as "10:07:39 PM"; the text itself when it isn't one. */
export function readableTime(date: string): string {
  const millis = wallMillis(date);
  if (millis === null) return date;
  return new Date(millis).toLocaleTimeString(undefined, { timeZone: "UTC", timeStyle: "medium" });
}

/** The UTC offset as it reads, such as "UTC+9" or "UTC−3:30". */
function readableOffset(millis: number): string {
  const minutes = Math.round(millis / 60_000);
  if (minutes === 0) return "UTC";
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `UTC${signOf(minutes)}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

/** The timezone's offset on the day as it reads, such as "UTC+9"; "" when the zone isn't known. */
export function zoneOffsetOn(zone: string, day: string): string {
  const wall = wallMillis(`${day.replaceAll("-", ":")} 12:00:00`);
  if (wall === null || !isZone(zone)) return "";
  return readableOffset(offsetAt(instantOf(wall, zone), zone));
}

/** Every timezone this browser knows, by IANA name, with UTC first. */
export function knownZones(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return ["UTC", ...zones.filter((zone) => zone !== "UTC")];
}

/** The timezone this browser is set to, which the start timezone begins as. */
export function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
