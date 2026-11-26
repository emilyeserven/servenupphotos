import { savedPlaces } from "@/api/places";
import { plainCaption } from "@/lib/caption-styles";
import type { CaptionLists } from "@/lib/caption-template";
import { textOf } from "@portfolio/lib/values";

/** A part of a photo's location, or a line, that a book photo's caption can leave out. */
export interface LocationPart {
  /**
   * How the book photo's `hidden` names it: `place:<id>`, `placeName`, `city`, `state` or
   * `country`, or `line:<n>` for the caption's line n, 0 for the first.
   */
  key: string;
  /** What it's called, such as "Gyeongbokgung" or "Seoul". */
  name: string;
  /** What kind of part it is, such as "Place", "City" or "Line". */
  kind: string;
}

/** The region fields a caption reads, each the custom one first, by the key that hides them. */
const REGIONS = [
  { key: "city", kind: "City", fields: ["customCity", "city"] },
  { key: "state", kind: "State", fields: ["customState", "state"] },
  { key: "country", kind: "Country", fields: ["customCountry", "country"] },
];

/** The first of the photo's fields with text, or "". */
function firstOf(photo: Record<string, unknown>, fields: string[]): string {
  return fields.map((f) => textOf(photo[f])).find(Boolean) ?? "";
}

/**
 * The parts of the photo's location its caption can leave out: each of its places, or its place
 * name when it has none, then its city, state and country, each when it has one.
 */
export function locationParts(photo: Record<string, unknown>, lists: CaptionLists): LocationPart[] {
  const places = savedPlaces(photo.places).flatMap(({ id }) => {
    const place = lists.places.find((p) => p.id === id);
    return place ? [{ key: `place:${id}`, name: place.name, kind: "Place" }] : [];
  });
  const placeName = textOf(photo.placeName);
  const named =
    places.length === 0 && placeName ? [{ key: "placeName", name: placeName, kind: "Place" }] : [];
  const regions = REGIONS.flatMap(({ key, kind, fields }) => {
    const name = firstOf(photo, fields);
    return name ? [{ key, name, kind }] : [];
  });
  return [...places, ...named, ...regions];
}

/**
 * The photo's fields as if the hidden parts of its location weren't there, so its caption, place
 * name builder included, fills in without them: hidden places off its list, its place name, city,
 * state or country (custom one too) empty.
 */
export function withHiddenParts(
  photo: Record<string, unknown>,
  hidden: string[] | undefined,
): Record<string, unknown> {
  if (!hidden?.length) return photo;
  const out: Record<string, unknown> = { ...photo };
  if (Array.isArray(photo.places)) {
    out.places = photo.places.filter(
      (p) => !hidden.includes(`place:${(p as { id?: unknown } | null)?.id}`),
    );
  }
  if (hidden.includes("placeName")) out.placeName = "";
  for (const { key, fields } of REGIONS) {
    if (hidden.includes(key)) for (const field of fields) out[field] = "";
  }
  return out;
}

/** The hidden parts with key hidden or shown again, in the order they were hidden. */
export function toggledHidden(hidden: string[] | undefined, key: string): string[] {
  const list = hidden ?? [];
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

/** How a book photo's `hidden` names the caption's line i, 0 for the first. */
function lineKey(i: number): string {
  return `line:${i}`;
}

/** The caption's lines it can leave out, each with its text without style marks; none for a blank line. */
export function captionLineParts(caption: string): LocationPart[] {
  return caption.split("\n").flatMap((line, i) => {
    const name = plainCaption(line).trim();
    return name ? [{ key: lineKey(i), name, kind: "Line" }] : [];
  });
}

/** The caption without the lines hidden for its photo in the book. */
export function withoutHiddenLines(caption: string, hidden: string[] | undefined): string {
  if (!hidden?.some((key) => key.startsWith("line:"))) return caption;
  return caption
    .split("\n")
    .filter((_, i) => !hidden.includes(lineKey(i)))
    .join("\n");
}
