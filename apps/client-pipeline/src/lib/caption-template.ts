import type { CombinedData } from "@/api/photos";
import { type Localization, type Place, savedPlaces } from "@/api/places";

/** The places, localizations, albums, tags and genres a caption names, from the combined lists. */
export interface CaptionLists {
  places: Place[];
  localizations: Localization[];
  /** The albums', tags' and genres' names by ID. */
  names: Record<"albums" | "tags" | "genres", Map<string, string>>;
}

interface Named {
  id: string;
  name: string;
}

function isNamed(value: unknown): value is Named {
  const v = value as Partial<Named> | null;
  return typeof v?.id === "string" && typeof v.name === "string";
}

type ListName = "places" | "localizations" | "albums" | "tags" | "genres";

/** One combined list's named entries, as the next Commit will have them; none before it's read. */
function namedEntries(data: CombinedData | undefined, list: ListName): Named[] {
  if (!data) return [];
  return ((data.head ?? data.base)[list].data ?? []).filter(isNamed);
}

/** The lists a caption names, as the next Commit will have them. */
export function captionLists(data: CombinedData | undefined): CaptionLists {
  const names = (list: ListName) => new Map(namedEntries(data, list).map((e) => [e.id, e.name]));
  return {
    places: namedEntries(data, "places") as Place[],
    localizations: namedEntries(data, "localizations") as Localization[],
    names: { albums: names("albums"), tags: names("tags"), genres: names("genres") },
  };
}

/** Placeholders a template can use that go together, such as a city's in each script, and what they're filled with. */
interface Placeholder {
  names: string[];
  help: string;
}

/** A place, city, state or country's placeholders: in English, its own script, Latin letters, and both. */
function localPlaceholders(name: string, what: string): Placeholder {
  return {
    names: ["", "Local", "Romanized", "Localized"].map((suffix) => name + suffix),
    help: `${what}: in English, its own script, Latin letters, and both, such as 경복궁 (Gyeongbokgung)`,
  };
}

function one(name: string, help: string): Placeholder {
  return { names: [name], help };
}

/**
 * The placeholders the Caption Templates page lists. Any other field of the photo JSON that holds
 * text or a number can be used too, such as `{customCity}` or `{createDate}`.
 */
export const PLACEHOLDERS: Placeholder[] = [
  one("title", "The photo's title"),
  one("comment", "The photo's comment"),
  {
    names: ["date", "year", "month", "day", "time"],
    help: "When it was taken (the custom date first), such as 2026.05.17, 2026, 05, 17 and 13:58",
  },
  one("camera", "The camera, after camera overrides, such as Fujifilm X-T5"),
  {
    names: ["lens", "lensShort"],
    help: "The lens, after camera overrides and the custom lens; and only up to its focal length, such as XF18-135mm",
  },
  one("focalLength", "The focal length in mm, rounded, such as 93"),
  one("aperture", "The f-number, such as 5.6; empty for a manual aperture"),
  one("exposure", "The exposure time, such as 1/140"),
  one("iso", "The ISO, such as 640"),
  one(
    "places",
    "Every place, each localized, with how the photo relates to the later ones, such as 경복궁 (Gyeongbokgung), near 장고 (Janggo)",
  ),
  localPlaceholders("place", "The most specific of the photo's places"),
  localPlaceholders("mainPlace", "The place the photo's places are in, such as a palace"),
  localPlaceholders("city", "The city (the custom city first)"),
  localPlaceholders("state", "The state, province or prefecture (the custom one first)"),
  localPlaceholders("country", "The country (the custom country first)"),
  one("gpsPosition", "The GPS position (the custom one first)"),
  {
    names: ["albums", "tags", "genres"],
    help: "The albums', tags' and photographic genres' names, with commas between",
  },
  one("file", "The original file's name, such as DSCF4800.jpg"),
  one("hashtags", "The post's hashtags, each with its #, such as #travelphotography"),
];

/** What each placeholder is filled with; a missing or empty one has nothing. */
export type CaptionValues = Record<string, string>;

/** The first value with text in it, trimmed, or "". */
function firstText(...values: unknown[]): string {
  const found = values.find((v) => typeof v === "string" && v.trim() !== "");
  return typeof found === "string" ? found.trim() : "";
}

/** A field's value as text: a number or text as it is, null as empty, and anything else as nothing. */
function plainText(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  return value === null ? "" : undefined;
}

/** The photo's fields that hold text, a number or null, as text, so even an empty one is known. */
function plainValues(photo: Record<string, unknown>): CaptionValues {
  const out: CaptionValues = {};
  for (const [key, value] of Object.entries(photo)) {
    const text = plainText(value);
    if (text !== undefined) out[key] = text;
  }
  return out;
}

const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})(?: (\d{2}):(\d{2}))?/;

/** When the photo was taken, the custom date first, as its parts. */
function dateValues(photo: Record<string, unknown>): CaptionValues {
  const match = EXIF_DATE.exec(firstText(photo.customCreateDate, photo.createDate));
  if (!match) return { date: "", year: "", month: "", day: "", time: "" };
  const [year = "", month = "", day = "", hour, minute] = match.slice(1);
  const time = hour ? `${hour}:${minute}` : "";
  return { date: `${year}.${month}.${day}`, year, month, day, time };
}

/** A focal length as photographers write it: whole millimeters, or one decimal under 10mm. */
function focalLengthText(value: unknown): string {
  if (typeof value !== "number") return "";
  return String(value < 10 ? Math.round(value * 10) / 10 : Math.round(value));
}

/** The lens's name up to its focal length, such as "XF18-135mm" for "XF18-135mmF3.5-5.6R LM OIS WR". */
function lensShort(lens: string): string {
  return /^.*?\d\s?mm/i.exec(lens)?.[0] ?? lens;
}

/** The camera and lens values, with the focal length rounded. */
function cameraValues(photo: Record<string, unknown>): CaptionValues {
  const lens = firstText(photo.lens);
  return { lens, lensShort: lensShort(lens), focalLength: focalLengthText(photo.focalLength) };
}

/** The names of the IDs in the photo's list field, with commas between. */
function groupNames(value: unknown, names: Map<string, string>): string {
  const ids = Array.isArray(value) ? value : [];
  return ids.flatMap((id) => names.get(String(id)) ?? []).join(", ");
}

/** The localization with the ID, or of the type and name, from LOCALIZATIONS.json. */
function findLocalization(
  lists: CaptionLists,
  type: Localization["type"],
  name: string,
  id?: string,
): Localization | undefined {
  const wanted = name.toLowerCase();
  return lists.localizations.find((l) =>
    id ? l.id === `place-${id}` : l.type === type && l.name.toLowerCase() === wanted,
  );
}

/** The name in its own script with its romanization, or else its name, after it, such as 경복궁 (Gyeongbokgung). */
function localizedName(name: string, found?: Localization): string {
  if (!found) return name;
  const local = firstText(found.localScript);
  const latin = firstText(found.romanization, name);
  return local && local !== latin ? `${local} (${latin})` : name;
}

/** A name written each way, as the placeholders named after it. */
function localValues(prefix: string, name: string, found?: Localization): CaptionValues {
  return {
    [prefix]: name,
    [`${prefix}Local`]: firstText(found?.localScript),
    [`${prefix}Romanized`]: firstText(found?.romanization),
    [`${prefix}Localized`]: name && localizedName(name, found),
  };
}

function placeById(lists: CaptionLists, id: string | undefined): Place | undefined {
  return lists.places.find((p) => p.id === id);
}

/** The place and every place it's in, outermost last, stopping where a loop of parents comes back. */
function ancestry(lists: CaptionLists, place: Place | undefined): Place[] {
  const out: Place[] = [];
  for (let p = place; p && !out.includes(p); p = placeById(lists, p.parent)) out.push(p);
  return out;
}

/** One of the photo's places, from PLACES.json, and how the photo relates to it, such as "near". */
interface RelatedPlace {
  place: Place;
  relation: string;
}

/** The photo's places from PLACES.json, in order; or else its place name, when it names one by ID. */
function photoPlaces(photo: Record<string, unknown>, lists: CaptionLists): RelatedPlace[] {
  const saved = savedPlaces(photo.places);
  const listed = saved.length > 0 ? saved : [{ relation: "", id: firstText(photo.placeName) }];
  return listed.flatMap(({ relation, id }) => {
    const place = placeById(lists, id);
    return place ? [{ place, relation }] : [];
  });
}

function placeLocalization(lists: CaptionLists, place: Place | undefined) {
  return place && findLocalization(lists, "place", "", place.id);
}

/** Every place, written in its own script with its romanization, the later ones after their relation, such as "경복궁 (Gyeongbokgung), near 장고 (Janggo)". */
function allPlaces(places: RelatedPlace[], lists: CaptionLists): string {
  const written = places.map(({ place, relation }, i) => {
    const name = localizedName(place.name, placeLocalization(lists, place));
    return i > 0 && relation ? `${relation} ${name}` : name;
  });
  return written.join(", ");
}

/** The place placeholders: every place, the most specific place, and the one they're all in. */
function placeValues(photo: Record<string, unknown>, lists: CaptionLists): CaptionValues {
  const places = photoPlaces(photo, lists);
  const written = (prefix: string, place?: Place) =>
    localValues(prefix, place?.name ?? "", placeLocalization(lists, place));
  const specific = places.at(-1)?.place;
  const values: CaptionValues = {
    ...written("place", specific),
    ...written("mainPlace", ancestry(lists, places[0]?.place).at(-1)),
    places: allPlaces(places, lists),
  };
  if (!specific) values.place = values.placeLocalized = values.places = firstText(photo.placeName);
  return values;
}

/** The city, state and country placeholders, each the custom one first. */
function regionValues(photo: Record<string, unknown>, lists: CaptionLists): CaptionValues {
  const region = (type: "city" | "state" | "country", custom: string) => {
    const name = firstText(photo[custom], photo[type]);
    return localValues(type, name, name ? findLocalization(lists, type, name) : undefined);
  };
  return {
    ...region("city", "customCity"),
    ...region("state", "customState"),
    ...region("country", "customCountry"),
  };
}

/**
 * What each placeholder is filled with for the photo, from its JSON and the combined lists, and for
 * the post, from its hashtags.
 */
export function captionValues(
  photo: Record<string, unknown>,
  lists: CaptionLists,
  hashtags: string[] = [],
): CaptionValues {
  return {
    ...plainValues(photo),
    ...dateValues(photo),
    ...cameraValues(photo),
    ...placeValues(photo, lists),
    ...regionValues(photo, lists),
    gpsPosition: firstText(photo.customGpsPosition, photo.gpsPosition),
    albums: groupNames(photo.albums, lists.names.albums),
    tags: groupNames(photo.tags, lists.names.tags),
    genres: groupNames(photo.genres, lists.names.genres),
    hashtags: hashtags.map((tag) => `#${tag}`).join(" "),
  };
}

/** A placeholder: a name in braces, with other names to fall back on after `|`, such as `{placeLocal|place}`. */
const PLACEHOLDER = /\{([A-Za-z]\w*(?:\|[A-Za-z]\w*)*)\}/g;

/** An optional part in square brackets, left out when a placeholder in it is empty. */
const SECTION = /\[([^[\]]*)\]/g;

/** The value of the first of the names that has one. */
function valueOf(names: string, values: CaptionValues): string {
  return names.split("|").reduce((found, name) => found || (values[name] ?? ""), "");
}

/** The text with its placeholders filled, and whether one of them was empty. */
function fill(text: string, values: CaptionValues): { text: string; empty: boolean } {
  let empty = false;
  const filled = text.replace(PLACEHOLDER, (_, names: string) => {
    const value = valueOf(names, values);
    empty ||= value === "";
    return value;
  });
  return { text: filled, empty };
}

/** An optional part filled, or nothing when it has a placeholder that's empty. */
function fillSection(section: string, values: CaptionValues): string {
  const { text, empty } = fill(section, values);
  return empty ? "" : text;
}

/** Whether the line has placeholders, and every one of them is empty. */
function onlyEmpty(line: string, values: CaptionValues): boolean {
  const names = [...line.matchAll(PLACEHOLDER)].map((m) => m[1] ?? "");
  return names.length > 0 && names.every((n) => valueOf(n, values) === "");
}

/** A line filled, or null when all its placeholders are empty, so it's left out. */
function fillLine(line: string, values: CaptionValues): string | null {
  if (onlyEmpty(line, values)) return null;
  const withSections = line.replace(SECTION, (whole, section: string) =>
    PLACEHOLDER.test(section) ? fillSection(section, values) : whole,
  );
  return fill(withSections, values).text;
}

/**
 * The caption the template makes from the values: each placeholder filled, an optional part in
 * square brackets left out when a placeholder in it is empty, and a line left out when every
 * placeholder in it is empty, with no more than one blank line in a row.
 */
export function fillCaption(template: string, values: CaptionValues): string {
  const lines = template.split("\n").flatMap((line) => fillLine(line, values) ?? []);
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The template's placeholder names that aren't listed and that the photo has no field for. */
export function unknownPlaceholders(template: string, values: CaptionValues): string[] {
  const known = new Set([...PLACEHOLDERS.flatMap((p) => p.names), ...Object.keys(values)]);
  const names = [...template.matchAll(PLACEHOLDER)].flatMap((m) => (m[1] ?? "").split("|"));
  return [...new Set(names.filter((name) => !known.has(name)))];
}

/** The template a new one starts with, in the photo caption style of the portfolio's comments. */
export const STARTER_TEMPLATE = [
  "{title}",
  "",
  "{date}",
  "{camera}[, {lensShort} @ {focalLength}mm][, {exposure}sec][, ƒ {aperture}][, ISO {iso}]",
  "{places|cityLocalized}",
  "",
  "{comment}",
  "",
  "{hashtags}",
].join("\n");
