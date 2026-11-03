import { format } from "date-fns";
import {
  CAMERA_FILTER_KEYS,
  filterWithCamera,
  parseCameraFilters,
} from "@portfolio/lib/camera-filters";
import {
  COLOR_FILTER_KEYS,
  colorFilterCount,
  filterByColors,
  parseColorFilters,
} from "@portfolio/lib/color-search";
import { albums as builtAlbums, type Group } from "@portfolio/lib/groups";
import { FILTER_KEYS, filterCount, parseFilters } from "@portfolio/lib/photo-filters";
import type { Photo } from "@portfolio/lib/photos";
import { findTimelineLabel, type TimelineLabel } from "@portfolio/lib/timeline-labels";

/**
 * The rules only a Smart Album has, besides the Grid's filters: a timeline label whose days its
 * photos were taken on, and the first and last days, each written as "2026-09-22".
 */
const DATE_RULE_KEYS = ["label", "from", "to"] as const;

/**
 * Every rule a Smart Album can have, named as the portfolio Grid's URL names its filters: places,
 * album, tag and genre, camera and lens, the setting and time of day sliders, orientation and
 * colors, then the timeline label and the first and last days.
 */
export const SMART_RULE_KEYS: readonly string[] = [
  ...FILTER_KEYS,
  ...CAMERA_FILTER_KEYS,
  ...COLOR_FILTER_KEYS,
  ...DATE_RULE_KEYS,
];

/**
 * A Smart Album's rules, as its file's `rules` keeps them: each filter by its URL name, with the
 * value the URL gives it, such as `{ "tag": "night", "orientation": "vertical" }`.
 */
export type SmartRules = Record<string, unknown>;

/** The days a photo has to be taken on, each written as "2026-09-22"; an end left out is open. */
interface DayRange {
  from?: string;
  to?: string;
}

/** The text value, or undefined when it's empty or not text. */
function textOf(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** The first, last and timeline label rules in search, leaving out any that are empty. */
function parseDateRules(search: Record<string, unknown>): SmartRules {
  return Object.fromEntries(
    DATE_RULE_KEYS.flatMap((key) => {
      const value = textOf(search[key]);
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

/** The rules a Smart Album could keep from search, leaving out anything that isn't one. */
export function parseSmartRules(search: Record<string, unknown>): SmartRules {
  return {
    ...parseFilters(search),
    ...parseCameraFilters(search),
    ...parseColorFilters(search),
    ...parseDateRules(search),
  };
}

/** How many rules are set: each place, and every other filter once. */
export function ruleCount(rules: SmartRules | null | undefined): number {
  if (!rules) return 0;
  const camera = Object.keys(parseCameraFilters(rules)).length;
  const dates = Object.keys(parseDateRules(rules)).length;
  return (
    filterCount(parseFilters(rules)) + camera + colorFilterCount(parseColorFilters(rules)) + dates
  );
}

/** Whether the album is a Smart Album: one whose photos come from rules rather than being chosen. */
export function isSmartAlbum(album: Pick<Group, "rules">): boolean {
  return ruleCount(album.rules) > 0;
}

/** The later of two days, either of which can be missing. */
function later(a?: string, b?: string): string | undefined {
  return [a, b].filter(Boolean).toSorted().at(-1);
}

/** The earlier of two days, either of which can be missing. */
function earlier(a?: string, b?: string): string | undefined {
  return [a, b].filter(Boolean).toSorted().at(0);
}

/**
 * The days the rules allow: from the later of the first day and the label's start, to the earlier
 * of the last day and the label's end. Undefined when the rules name a label that's gone, which
 * no photo is in.
 */
function dayRange(rules: SmartRules, labels?: TimelineLabel[]): DayRange | undefined {
  const label = labelRange(textOf(rules.label), labels);
  if (!label) return undefined;
  return { from: later(textOf(rules.from), label.from), to: earlier(textOf(rules.to), label.to) };
}

/** The days of the timeline label with the ID, every day when there's no ID, or undefined when it's gone. */
function labelRange(id: string | undefined, labels?: TimelineLabel[]): DayRange | undefined {
  if (id === undefined) return {};
  const label = findTimelineLabel(id, labels);
  return label && { from: label.start, to: label.end };
}

/** Whether the day, written as "2026-09-22", is inside range. */
function inRange(day: string, { from = "", to = "9999-12-31" }: DayRange): boolean {
  return from <= day && day <= to;
}

/** Whether the photo was taken on a day the rules allow, by the clock where it was taken. */
function matchesDays(photo: Photo, rules: SmartRules, labels?: TimelineLabel[]): boolean {
  const range = dayRange(rules, labels);
  return range !== undefined && inRange(format(photo.takenAt, "yyyy-MM-dd"), range);
}

/**
 * Whether the photo matches every one of a Smart Album's rules, the way the portfolio Grid's
 * filters would match it, and was taken on the days they allow. `labels` are the timeline labels
 * to look the label rule up in, the portfolio's own when left out.
 */
export function matchesRules(photo: Photo, rules: SmartRules, labels?: TimelineLabel[]): boolean {
  const grid = filterByColors(filterWithCamera([photo], rules), parseColorFilters(rules));
  return grid.length === 1 && matchesDays(photo, rules, labels);
}

/** The IDs of the Smart Albums in smart whose rules the photo matches and that it doesn't list itself. */
function smartAlbumIds(photo: Photo, smart: Group[], labels?: TimelineLabel[]): string[] {
  return smart
    .filter((album) => !photo.albums.includes(album.id))
    .filter((album) => matchesRules(photo, album.rules ?? {}, labels))
    .map((album) => album.id);
}

/**
 * The photos, each with the IDs of the Smart Albums whose rules it matches added after its own
 * albums, so every view, filter and count sees it in them. A rule naming an album matches only the
 * photos that list that album themselves, so one Smart Album's rules never depend on another's.
 * `albums` are the portfolio's own when left out; the pipeline passes the ones on GitHub.
 */
export function withSmartAlbums<T extends Photo>(
  list: T[],
  albums: Group[] = builtAlbums,
  labels?: TimelineLabel[],
): T[] {
  const smart = albums.filter(isSmartAlbum);
  if (smart.length === 0) return list;
  return list.map((photo) => {
    const ids = smartAlbumIds(photo, smart, labels);
    return ids.length === 0 ? photo : { ...photo, albums: [...photo.albums, ...ids] };
  });
}
