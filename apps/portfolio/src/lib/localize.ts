import committedLocalizations from "@/data/localizations/LOCALIZATIONS.json";
import committedPlaces from "@/data/places/PLACES.json";

/**
 * How place, city and country names are written: as named in English, romanized, as they're said
 * locally (such as furigana), or in their local script (such as hangeul or kanji).
 */
export type ScriptDisplay = "english" | "romanized" | "phonetic" | "native";

/** Every Script Display, least to most native, as the menu lists them. */
export const SCRIPT_DISPLAYS: readonly ScriptDisplay[] = [
  "english",
  "romanized",
  "phonetic",
  "native",
];

/** A name written each way a visitor can choose. */
export type Localized = Record<ScriptDisplay, string>;

/** A place from PLACES.json, which photos list by ID. */
export interface Place {
  id: string;
  name: string;
  description?: string;
  /** The ID of the less specific place this one is in, such as the palace a gate is in. */
  parent?: string;
  /** The place's GPS position in decimal degrees, for photos whose EXIF has none. */
  latitude?: number;
  longitude?: number;
}

/** One entry of LOCALIZATIONS.json: how a country, city or place is written and said where it is. */
interface Localization {
  id: string;
  type: "country" | "city" | "place";
  name: string;
  romanization?: string;
  pronunciation?: string;
  localScript?: string;
}

/** The PLACES.local.json or LOCALIZATIONS.local.json `pnpm photos:local` makes, when it's there. */
function localFile<T>(files: Record<string, T[]>): T[] | undefined {
  const local = Object.values(files)[0];
  return local && local.length > 0 ? local : undefined;
}

// Like ALLPHOTOS.local.json, these are git-ignored and only there locally; a glob doesn't fail
// when they're missing.
const places: Place[] =
  localFile(
    import.meta.glob<Place[]>("../data/places/PLACES.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedPlaces as Place[]);

const localizations: Localization[] =
  localFile(
    import.meta.glob<Localization[]>("../data/localizations/LOCALIZATIONS.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedLocalizations as Localization[]);

/** The place with the ID, from PLACES.json. */
export function placeById(id: string | undefined): Place | undefined {
  return places.find((place) => place.id === id);
}

function key(type: Localization["type"], name: string): string {
  return `${type}:${name.trim().toLowerCase()}`;
}

/** Countries and cities are found by their name; places by their own ID, which the pipeline puts in the localization's. */
const byKey = new Map(
  localizations.map((l) => [l.type === "place" ? l.id : key(l.type, l.name), l]),
);

/** A place's localization ID, as the pipeline makes it. */
function placeKey(placeId: string): string {
  return `place-${placeId}`.slice(0, 100).replace(/-+$/, "");
}

function text(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** The localization field each way after English reads, least to most native. */
const FIELDS: [ScriptDisplay, "romanization" | "pronunciation" | "localScript"][] = [
  ["romanized", "romanization"],
  ["phonetic", "pronunciation"],
  ["native", "localScript"],
];

/**
 * The name written each way. A way with nothing saved for it falls back to the next less native
 * way that has something, so the most native one available, up to the chosen one, is shown.
 */
function localized(name: string, found: Localization | undefined): Localized {
  const written = unlocalized(name);
  let last = name;
  for (const [script, field] of FIELDS) {
    last = text(found?.[field]) || last;
    written[script] = last;
  }
  return written;
}

/** A country or city's name written each way, from LOCALIZATIONS.json. */
export function localizeName(type: "country" | "city", name: string): Localized {
  return localized(name, byKey.get(key(type, name)));
}

/** A place's name written each way, from LOCALIZATIONS.json. */
export function localizePlace(place: Place): Localized {
  return localized(place.name, byKey.get(placeKey(place.id)));
}

/** The same text every way, for names with no localization to look up. */
function unlocalized(value: string): Localized {
  return { english: value, romanized: value, phonetic: value, native: value };
}

/** Each way written by `write`, from the parts written that way. */
export function mapLocalized<T>(
  parts: T,
  write: (parts: T, script: ScriptDisplay) => string,
): Localized {
  return Object.fromEntries(
    SCRIPT_DISPLAYS.map((script) => [script, write(parts, script)]),
  ) as Localized;
}
