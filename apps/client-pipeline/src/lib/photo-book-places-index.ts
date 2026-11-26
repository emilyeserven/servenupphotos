import { type Place, savedPlaces } from "@/api/places";
import { type CaptionLists, placeScripts } from "@/lib/caption-template";
import type { GeneratedPage, IndexDepth, NameStyle } from "@/lib/photo-book-generated";
import { ancestors } from "@/lib/place-hierarchy";
import { stateAbbreviation } from "@/lib/us-states";
import { textOf } from "@portfolio/lib/values";

/** How specific an entry of a Places Index is, least specific first. */
type IndexLevel = IndexDepth | "place";

/** One entry of a Places Index: a country, state, city or place, and the entries in it. */
export interface IndexEntry {
  /** How the page's `hidden` names it: `country:<name>`, `state:<name>`, `city:<name>`, `place:<ID>` or `placeName:<text>`. */
  key: string;
  level: IndexLevel;
  /** What the page writes, after the page's options, such as "CA" or "경복궁 (Gyeongbokgung)". */
  name: string;
  /** The entries in it, in the page's order. */
  children: IndexEntry[];
}

/** One step of a photo's path down the index, before the page's options write its name. */
interface Step {
  key: string;
  level: IndexLevel;
  /** Its name in English, as the photo or place has it. */
  name: string;
  /** The place, for a place step that's in the places list. */
  place?: Place;
}

const LEVELS: IndexLevel[] = ["country", "state", "city", "place"];

/** The region fields, each the custom one first, least specific first. */
const REGIONS = [
  { level: "country", fields: ["customCountry", "country"] },
  { level: "state", fields: ["customState", "state"] },
  { level: "city", fields: ["customCity", "city"] },
] as const;

/** The photo's country, state and city, each it has, least specific first. */
function regionSteps(photo: Record<string, unknown>): Step[] {
  return REGIONS.flatMap(({ level, fields }) => {
    const name = fields.map((f) => textOf(photo[f])).find(Boolean);
    return name ? [{ key: `${level}:${name}`, level, name }] : [];
  });
}

/** A place as a step. */
function placeStep(place: Place): Step {
  return { key: `place:${place.id}`, level: "place", name: place.name, place };
}

/**
 * Each of the photo's places as a chain of steps from the place it's in outward down to it, such
 * as Gyeongbokgung, then Geunjeongmun Gate; or its place name alone, when it has no places.
 */
function placeChains(photo: Record<string, unknown>, lists: CaptionLists): Step[][] {
  const saved = savedPlaces(photo.places);
  const placeName = textOf(photo.placeName);
  const ids = saved.length > 0 ? saved.map((p) => p.id) : [placeName].filter(Boolean);
  return ids.flatMap((id) => {
    const place = lists.places.find((p) => p.id === id);
    if (place) return [[...ancestors(lists.places, id).toReversed(), place].map(placeStep)];
    return saved.length === 0 ? [[{ key: `placeName:${id}`, level: "place", name: id }]] : [];
  });
}

/** Whether the step is a place named the same as one of the regions, such as a place called Seoul in Seoul. */
function repeatsRegion(step: Step, regions: Step[]): boolean {
  const name = step.name.toLowerCase();
  return step.level === "place" && regions.some((r) => r.name.toLowerCase() === name);
}

/**
 * The steps without one named the same as the step after it, keeping the more specific, such as
 * Seoul the city and not Seoul the province it's in.
 */
function withoutRepeats(steps: Step[]): Step[] {
  return steps.filter((step, i) => step.name.toLowerCase() !== steps[i + 1]?.name.toLowerCase());
}

/** A city's place in the world, to find its state: its country and its name. */
function cityKey(regions: Step[]): string | undefined {
  const country = regions.find((r) => r.level === "country")?.name ?? "";
  const city = regions.find((r) => r.level === "city")?.name;
  return city && `${country}\n${city}`.toLowerCase();
}

/** The state each city is in, by its cityKey, from the first photo that has both. */
type KnownStates = Map<string, Step>;

/** The state each city of the photos is in, from the photos that have both. */
function knownStates(photos: Record<string, unknown>[]): KnownStates {
  const known: KnownStates = new Map();
  for (const photo of photos) {
    const regions = regionSteps(photo);
    const key = cityKey(regions);
    const state = regions.find((r) => r.level === "state");
    if (key && state && !known.has(key)) known.set(key, state);
  }
  return known;
}

/**
 * The regions with the state filled in when they have a city but no state and another photo has
 * that city in a state, so a photo missing its state goes under the same state as the others.
 */
function withKnownState(regions: Step[], known: KnownStates): Step[] {
  const key = cityKey(regions);
  const state = key && known.get(key);
  if (!state || regions.some((r) => r.level === "state")) return regions;
  const at = regions.findIndex((r) => r.level === "city");
  return regions.toSpliced(at, 0, state);
}

/** Every path the photo takes down the index: its regions, then each of its places' chains. */
function photoPaths(
  photo: Record<string, unknown>,
  lists: CaptionLists,
  known: KnownStates,
): Step[][] {
  const regions = withoutRepeats(withKnownState(regionSteps(photo), known));
  const chains = placeChains(photo, lists);
  if (chains.length === 0) return regions.length > 0 ? [regions] : [];
  return chains.map((chain) => [...regions, ...chain.filter((s) => !repeatsRegion(s, regions))]);
}

/** The keys a step can be hidden by: its own, and a state's or city's by the other's key of the same name, as they're one entry. */
function hideKeys(step: Step): string[] {
  if (step.level !== "state" && step.level !== "city") return [step.key];
  return [`state:${step.name}`, `city:${step.name}`];
}

/** The path without hidden steps and those more specific than the page's depth. */
function shownSteps(path: Step[], options: GeneratedPage): Step[] {
  const deepest = LEVELS.indexOf(options.depth ?? "place");
  const hidden = new Set(options.hidden);
  return path.filter(
    (step) =>
      LEVELS.indexOf(step.level) <= deepest && !hideKeys(step).some((key) => hidden.has(key)),
  );
}

/** How a name is written: as named, in its own script ("" for none) and in Latin letters. */
interface Written {
  name: string;
  local: string;
  romanized: string;
}

/** The name as named, with its own script after it when it has one that differs, such as Gyeongbokgung Palace (경복궁). */
function namedLocal({ name, local }: Written): string {
  return local && local !== name ? `${name} (${local})` : name;
}

/** A name as the style writes it; one with no own script is written in Latin letters (or as named for `namedLocal`). */
function styled(style: NameStyle, written: Written): string {
  const { local, romanized } = written;
  if (style === "namedLocal") return namedLocal(written);
  if (style === "romanized" || !local || local === romanized) return romanized;
  if (style === "local") return local;
  return style === "localRomanized" ? `${local} (${romanized})` : `${romanized} (${local})`;
}

/** How the page writes names: its `names`, or a page saved before it with `localized` on. */
function nameStyle(options: GeneratedPage): NameStyle | undefined {
  return options.names ?? (options.localized ? "localRomanized" : undefined);
}

/** The step's name as the page writes it: a US state abbreviated, or its localization, when it says to. */
function writtenName(step: Step, options: GeneratedPage, lists: CaptionLists): string {
  if (step.level === "state" && options.stateAbbreviations) {
    const short = stateAbbreviation(step.name);
    if (short !== step.name) return short;
  }
  const style = nameStyle(options);
  if (!style) return step.name;
  return styled(style, {
    name: step.name,
    ...placeScripts(lists, step.level, step.name, step.place?.id),
  });
}

/** Whether the level is a state or a city, which an entry of the same name merges across. */
function isStateOrCity(level: IndexLevel): boolean {
  return level === "state" || level === "city";
}

/** Whether the entry is the step's: the same key, or a state and a city of the same name. */
function sameEntry(entry: IndexEntry, step: Step, english: Map<IndexEntry, string>): boolean {
  if (entry.key === step.key) return true;
  const both = isStateOrCity(entry.level) && isStateOrCity(step.level);
  return both && english.get(entry)?.toLowerCase() === step.name.toLowerCase();
}

/**
 * The entry made one with a state or city of the same name: it keeps the state's key, so hiding
 * it hides both, and the city's name as written, such as Cairo the city in Cairo Governorate.
 */
function mergeInto(entry: IndexEntry, step: Step, written: string) {
  if (step.level === "state") Object.assign(entry, { key: step.key, level: step.level });
  else if (step.level === "city") entry.name = written;
}

/**
 * Puts the path into entries, under the entry each step before it made, each key once in its
 * entry, and a state and a city of the same name as one entry, such as Cairo the city and Cairo
 * Governorate. english keeps each entry's name in English, to find those.
 */
function insert(
  entries: IndexEntry[],
  path: Step[],
  options: GeneratedPage,
  lists: CaptionLists,
  english: Map<IndexEntry, string>,
) {
  let level = entries;
  for (const step of path) {
    let entry = level.find((e) => sameEntry(e, step, english));
    if (entry && entry.key !== step.key) mergeInto(entry, step, writtenName(step, options, lists));
    if (!entry) {
      entry = {
        key: step.key,
        level: step.level,
        name: writtenName(step, options, lists),
        children: [],
      };
      level.push(entry);
      english.set(entry, step.name);
    }
    level = entry.children;
  }
}

/** The entries and every entry in them sorted by name, as an index is. */
function sorted(entries: IndexEntry[]): IndexEntry[] {
  return entries
    .map((e) => ({ ...e, children: sorted(e.children) }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * A Places Index of the photos, given in the book's order: every country, state, city and place
 * they show, each place under the places it's in (from the places list), as the page's options
 * say. Each photo's country, state and city are the custom ones first. A photo with a city but no
 * state takes the state another photo has that city in; a level still missing is skipped, so a
 * city with no state sits right under its country. A state and a city of the same name are one
 * entry. A hidden entry's entries move up into the one above it.
 */
export function placesIndex(
  photos: Record<string, unknown>[],
  lists: CaptionLists,
  options: GeneratedPage,
): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const english = new Map<IndexEntry, string>();
  const known = knownStates(photos);
  for (const photo of photos) {
    for (const path of photoPaths(photo, lists, known)) {
      insert(entries, shownSteps(path, options), options, lists, english);
    }
  }
  return options.order === "book" ? entries : sorted(entries);
}

/** How many entries there are, at every level. */
export function entryCount(entries: IndexEntry[]): number {
  return entries.reduce((n, e) => n + 1 + entryCount(e.children), 0);
}
