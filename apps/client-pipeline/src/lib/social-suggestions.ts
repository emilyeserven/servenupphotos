import type { SocialPhoto } from "@/api/publish";
import { writtenPosition } from "@/lib/place-gps";
import { customOr, takenDay } from "@/lib/social-focus";
import { type Unsaved, dateOf } from "@/lib/social-schedule";
import { savedSocialPosts } from "@/lib/social-posts";

/** How many photos before a day the suggestions compare against. */
const REFERENCE_COUNT = 3;

/** How many suggestions the picker shows at most. */
const SUGGESTION_COUNT = 8;

/** The least score a photo needs to be suggested, so unrelated photos aren't. */
const MIN_SCORE = 0.2;

/** How much each kind of likeness counts: mostly place and date, partly tags. */
const WEIGHTS = { place: 0.4, date: 0.4, tags: 0.2 };

/** The distance, in km, at which two photos' place likeness halves. */
const HALF_KM = 25;

/** The number of days apart at which two photos' date likeness halves. */
const HALF_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What the suggestions compare about a photo, read once from its JSON. */
interface Traits {
  position: { latitude: number; longitude: number } | null;
  city: string;
  country: string;
  places: Set<string>;
  /** The day it was taken, as days since 1970, or null when it has no date. */
  day: number | null;
  tags: Set<string>;
}

/** A photo the picker suggests, with why: the closest it is to one of the photos before the day. */
export interface Suggestion {
  photo: SocialPhoto;
  /** From 0 to 1: how alike it is to the photos before the day, on average. */
  score: number;
  /** The fewest km to one of those photos, or null when distances can't be told. */
  km: number | null;
  /** The same city or place as one of those photos, when distances can't be told. */
  samePlace: boolean;
  /** The fewest days between it and one of those photos being taken, or null. */
  days: number | null;
  /** The most tags it shares with one of those photos. */
  sharedTags: number;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function custom(data: Record<string, unknown>, field: string): string {
  return customOr(data, field).toLowerCase();
}

function positionOf(data: Record<string, unknown>) {
  return writtenPosition(text(data.customGpsPosition)) ?? writtenPosition(text(data.gpsPosition));
}

/** The day the photo was taken, as days since 1970, or null when it has no date. */
function dayOf(data: Record<string, unknown>): number | null {
  const day = takenDay(data);
  return day ? Math.floor(Date.parse(day) / DAY_MS) : null;
}

function textSet(value: unknown, read: (item: unknown) => string): Set<string> {
  return new Set((Array.isArray(value) ? value : []).map(read).filter(Boolean));
}

function placeId(place: unknown): string {
  return typeof place === "object" && place !== null ? text((place as { id?: unknown }).id) : "";
}

function traitsOf({ data }: SocialPhoto): Traits {
  return {
    position: positionOf(data),
    city: custom(data, "city"),
    country: custom(data, "country"),
    places: textSet(data.places, placeId),
    day: dayOf(data),
    tags: textSet(data.tags, text),
  };
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** The distance between two GPS positions over the globe, in km. */
function kmBetween(a: Traits["position"] & {}, b: Traits["position"] & {}): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function km(a: Traits, b: Traits): number | null {
  return a.position && b.position ? kmBetween(a.position, b.position) : null;
}

function overlap(a: Set<string>, b: Set<string>): number {
  return [...a].filter((item) => b.has(item)).length;
}

function sameText(a: string, b: string): boolean {
  return a !== "" && a === b;
}

/** Whether the photos share a place or a city. */
function samePlace(a: Traits, b: Traits): boolean {
  return overlap(a.places, b.places) > 0 || sameText(a.city, b.city);
}

/** How near the photos were taken, from 1 for the same spot to 0 for nothing in common. */
function placeLikeness(a: Traits, b: Traits): number {
  const distance = km(a, b);
  if (distance !== null) return 1 / (1 + distance / HALF_KM);
  if (samePlace(a, b)) return 0.8;
  return sameText(a.country, b.country) ? 0.3 : 0;
}

function daysApart(a: Traits, b: Traits): number | null {
  return a.day === null || b.day === null ? null : Math.abs(a.day - b.day);
}

/** How near in time the photos were taken, from 1 for the same day towards 0. */
function dateLikeness(a: Traits, b: Traits): number {
  const days = daysApart(a, b);
  return days === null ? 0 : 1 / (1 + days / HALF_DAYS);
}

/** The share of their tags the photos have in common. */
function tagLikeness(a: Traits, b: Traits): number {
  const shared = overlap(a.tags, b.tags);
  const all = a.tags.size + b.tags.size - shared;
  return all === 0 ? 0 : shared / all;
}

function likeness(a: Traits, b: Traits): number {
  return (
    WEIGHTS.place * placeLikeness(a, b) +
    WEIGHTS.date * dateLikeness(a, b) +
    WEIGHTS.tags * tagLikeness(a, b)
  );
}

/** The days the photo is on Instagram: its calendar day and the days of its Instagram posts. */
function instagramDays(photo: SocialPhoto, unsaved: Unsaved): string[] {
  const posts = savedSocialPosts(photo.data).filter((post) => post.platform === "instagram");
  return [dateOf(unsaved, photo) ?? "", ...posts.map((post) => post.date)].filter(Boolean);
}

/** Whether the photo isn't scheduled on the calendar or posted or scheduled on Instagram. */
function isUnused(photo: SocialPhoto, unsaved: Unsaved): boolean {
  const posts = savedSocialPosts(photo.data).filter((post) => post.platform === "instagram");
  return dateOf(unsaved, photo) === null && posts.length === 0;
}

/** The latest day before day the photo is on Instagram, or "" when it isn't before then. */
function lastDayBefore(photo: SocialPhoto, unsaved: Unsaved, day: string): string {
  const before = instagramDays(photo, unsaved).filter((d) => d < day);
  return before.toSorted().at(-1) ?? "";
}

/** The photos on Instagram on the days just before day, the latest first. */
function photosBefore(photos: SocialPhoto[], unsaved: Unsaved, day: string) {
  return photos
    .map((photo) => ({ photo, last: lastDayBefore(photo, unsaved, day) }))
    .filter(({ last }) => last !== "")
    .toSorted((a, b) => b.last.localeCompare(a.last))
    .slice(0, REFERENCE_COUNT)
    .map(({ photo }) => photo);
}

function fewest(values: (number | null)[]): number | null {
  const known = values.filter((value) => value !== null);
  return known.length === 0 ? null : Math.min(...known);
}

function suggestion(photo: SocialPhoto, references: Traits[]): Suggestion {
  const traits = traitsOf(photo);
  const total = references.reduce((sum, ref) => sum + likeness(traits, ref), 0);
  return {
    photo,
    score: total / references.length,
    km: fewest(references.map((ref) => km(traits, ref))),
    samePlace: references.some((ref) => samePlace(traits, ref)),
    days: fewest(references.map((ref) => daysApart(traits, ref))),
    sharedTags: Math.max(...references.map((ref) => overlap(traits.tags, ref.tags))),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The photo with the last change waiting for Commit or local edit made to its JSON, if any. */
function withChange(photo: SocialPhoto, changed: Map<string, unknown>): SocialPhoto {
  const data = changed.get(photo.path);
  return isObject(data) ? { ...photo, data } : photo;
}

/**
 * The photos not used on Instagram yet that are most like the 3 photos on the days before day, by
 * where (mostly), when (mostly) and their tags (partly), the most alike first. None when no photo is
 * on Instagram before day. changed holds the photo files' changes not committed yet, by path, and
 * only photos that pass allowed are suggested, such as the ones the Focus lets through.
 */
export function suggestionsFor(
  read: SocialPhoto[],
  unsaved: Unsaved,
  day: string,
  changed: Map<string, unknown>,
  allowed: (photo: SocialPhoto) => boolean,
): Suggestion[] {
  const photos = read.map((photo) => withChange(photo, changed));
  const references = photosBefore(photos, unsaved, day).map(traitsOf);
  if (references.length === 0) return [];
  return photos
    .filter((photo) => isUnused(photo, unsaved) && allowed(photo))
    .map((photo) => suggestion(photo, references))
    .filter(({ score }) => score >= MIN_SCORE)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, SUGGESTION_COUNT);
}
