import type { SocialPhoto } from "@/api/publish";
import type { FieldChange, LocalEdit } from "@/stores/local-edits";

/** The photo JSON field that lists the spotlight zones a photo is in, by ID. */
export const SPOTLIGHT_ZONES = "spotlightZones";

/** A spot on the portfolio that shows the photos picked for it. */
export interface SpotlightZone {
  /** What the photo JSON's spotlightZones holds, such as "homepage". */
  id: string;
  label: string;
  /** Where the zone's photos show. */
  description: string;
  /** What the portfolio shows there while no photos are picked. */
  fallback: string;
}

/** Every spotlight zone, in the order the Site Spotlight page lists them. */
export const spotlightZones: SpotlightZone[] = [
  {
    id: "homepage",
    label: "Homepage",
    description: "Fades in and out, one photo at a time, behind the portfolio's homepage.",
    fallback: "No photos picked, so the homepage shows the 5 newest photos.",
  },
];

/** Photo file path → its unsaved spotlight zones; a path that's missing keeps its saved ones. */
export type UnsavedZones = Record<string, string[]>;

/** The zones saved in the photo's file; none when it has no spotlightZones list. */
function savedZones(photo: SocialPhoto): string[] {
  const zones = photo.data[SPOTLIGHT_ZONES];
  return Array.isArray(zones) ? zones.filter((zone) => typeof zone === "string") : [];
}

/** The photo's spotlight zones with the unsaved ones applied. */
export function zonesOf(unsaved: UnsavedZones, photo: SocialPhoto): string[] {
  return unsaved[photo.path] ?? savedZones(photo);
}

/** Whether the photo's zones differ from the ones saved in its file. */
export function zonesUnsaved(unsaved: UnsavedZones, photo: SocialPhoto): boolean {
  return !sameZones(zonesOf(unsaved, photo), savedZones(photo));
}

function sameZones(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((zone) => b.includes(zone));
}

/** The spotlight zones among the local edits, by photo file path. */
export function unsavedZonesFromEdits(edits: Record<string, LocalEdit>): UnsavedZones {
  const unsaved: UnsavedZones = {};
  for (const edit of Object.values(edits)) {
    const zones = edit.fields[SPOTLIGHT_ZONES];
    if (Array.isArray(zones)) unsaved[edit.path] = zones as string[];
  }
  return unsaved;
}

/**
 * The local edit that puts photo in zone, or takes it out. Going back to the zones the file has
 * sets the file's own value, which drops the edit.
 */
export function zoneChange(
  unsaved: UnsavedZones,
  photo: SocialPhoto,
  zone: string,
  on: boolean,
): FieldChange {
  const others = zonesOf(unsaved, photo).filter((z) => z !== zone);
  const next = on ? [...others, zone] : others;
  const value = sameZones(next, savedZones(photo)) ? (photo.data[SPOTLIGHT_ZONES] ?? null) : next;
  return { path: photo.path, before: photo.data, value };
}

/** The photos in zone, newest first. */
export function zonePhotos(photos: SocialPhoto[], unsaved: UnsavedZones, zone: string) {
  return photos
    .filter((photo) => zonesOf(unsaved, photo).includes(zone))
    .toSorted((a, b) => (b.createDate ?? "").localeCompare(a.createDate ?? ""));
}
