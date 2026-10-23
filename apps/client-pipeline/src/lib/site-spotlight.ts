import type { SocialPhoto } from "@/api/publish";
import type { FieldChange, LocalEdit } from "@/stores/local-edits";

/** The photo JSON field that lists the spotlight zones a photo is in, by ID. */
export const SPOTLIGHT_ZONES = "spotlightZones";

/**
 * The photo JSON field that holds the photo's place among the spotlighted photos, 1 first; null
 * for a photo that hasn't been given one, which comes after the ones that have.
 */
export const SPOTLIGHT_ORDER = "websiteSpotlight";

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

/** Photo file path → its unsaved place in the order; a path that's missing keeps its saved one. */
export type UnsavedOrder = Record<string, number | null>;

/** The place saved in the photo's file, or null without one. */
function savedOrder(photo: SocialPhoto): number | null {
  const place = photo.data[SPOTLIGHT_ORDER];
  return typeof place === "number" ? place : null;
}

/** The photo's place in the order with the unsaved ones applied. */
export function orderOf(order: UnsavedOrder, photo: SocialPhoto): number | null {
  return photo.path in order ? (order[photo.path] ?? null) : savedOrder(photo);
}

/** The places in the order among the local edits, by photo file path. */
export function unsavedOrderFromEdits(edits: Record<string, LocalEdit>): UnsavedOrder {
  const order: UnsavedOrder = {};
  for (const edit of Object.values(edits)) {
    if (SPOTLIGHT_ORDER in edit.fields)
      order[edit.path] = edit.fields[SPOTLIGHT_ORDER] as number | null;
  }
  return order;
}

/** The photo's place in the order, counted from 1 among the photos in zone; null when it isn't in it. */
export function placeInZone(
  photos: SocialPhoto[],
  unsaved: UnsavedZones,
  order: UnsavedOrder,
  zone: string,
  path: string,
) {
  const index = zonePhotos(photos, unsaved, order, zone).findIndex((p) => p.path === path);
  return index === -1 ? null : index + 1;
}

/** Ranks a photo without a place after every photo with one. */
function rank(place: number | null): number {
  return place ?? Number.MAX_SAFE_INTEGER;
}

/** Newest first, by creation date. */
export function newestFirst(a: SocialPhoto, b: SocialPhoto): number {
  return (b.createDate ?? "").localeCompare(a.createDate ?? "");
}

/** The photos in zone in their order: by place, 1 first, then the ones without one, newest first. */
export function zonePhotos(
  photos: SocialPhoto[],
  unsaved: UnsavedZones,
  order: UnsavedOrder,
  zone: string,
) {
  return photos
    .filter((photo) => zonesOf(unsaved, photo).includes(zone))
    .toSorted((a, b) => rank(orderOf(order, a)) - rank(orderOf(order, b)) || newestFirst(a, b));
}

/** The local edit that gives photo place in the order, or takes its place away with null. */
export function orderChange(photo: SocialPhoto, place: number | null): FieldChange {
  return { path: photo.path, before: photo.data, value: place };
}

/**
 * The local edits that move the photo at index from to index to among list, a zone's photos in
 * their order: each photo gets its new place, 1 first.
 */
export function moveChanges(list: SocialPhoto[], from: number, to: number): FieldChange[] {
  const moved = list[from];
  if (!moved || from === to) return [];
  const next = list.toSpliced(from, 1).toSpliced(to, 0, moved);
  return numbered(next);
}

/** The local edits that give each photo in list its place there, 1 first. */
function numbered(list: SocialPhoto[]): FieldChange[] {
  return list.map((photo, index) => orderChange(photo, index + 1));
}

/**
 * The local edits that put photo at the end of list, a zone's photos in their order, numbering
 * them all so photos without a place yet don't come after it.
 */
export function appendChanges(list: SocialPhoto[], photo: SocialPhoto): FieldChange[] {
  return numbered([...list.filter((p) => p.path !== photo.path), photo]);
}
