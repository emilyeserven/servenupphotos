import type { PhotoEntry } from "@portfolio/lib/photos";

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

/** The camera settings in the photo's JSON entry, with a setting it was saved without as null. */
export function cameraSettings(photo: PhotoEntry): CameraSettings {
  const { aperture = null, exposure = null, iso = null, focalLength = null } = photo;
  return { aperture, exposure, iso, focalLength, manualAperture: photo.manualAperture === true };
}
