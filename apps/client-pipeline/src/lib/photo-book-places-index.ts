import { type Place, savedPlaces } from "@/api/places";
import { type CaptionLists, localizedPlaceName } from "@/lib/caption-template";
import type { GeneratedPage, IndexDepth } from "@/lib/photo-book-generated";
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

/** Every path the photo takes down the index: its regions, then each of its places' chains. */
function photoPaths(photo: Record<string, unknown>, lists: CaptionLists): Step[][] {
  const regions = withoutRepeats(regionSteps(photo));
  const chains = placeChains(photo, lists);
  if (chains.length === 0) return regions.length > 0 ? [regions] : [];
  return chains.map((chain) => [...regions, ...chain.filter((s) => !repeatsRegion(s, regions))]);
}

/** The path without hidden steps and those more specific than the page's depth. */
function shownSteps(path: Step[], options: GeneratedPage): Step[] {
  const deepest = LEVELS.indexOf(options.depth ?? "place");
  const hidden = new Set(options.hidden);
  return path.filter((step) => LEVELS.indexOf(step.level) <= deepest && !hidden.has(step.key));
}

/** The step's name as the page writes it: a state abbreviated, or a name localized, when it says to. */
function writtenName(step: Step, options: GeneratedPage, lists: CaptionLists): string {
  if (step.level === "state" && options.stateAbbreviations) {
    const short = stateAbbreviation(step.name);
    if (short !== step.name) return short;
  }
  if (!options.localized) return step.name;
  return localizedPlaceName(lists, step.level, step.name, step.place?.id);
}

/** Puts the path into entries, under the entry each step before it made, each key once in its entry. */
function insert(entries: IndexEntry[], path: Step[], options: GeneratedPage, lists: CaptionLists) {
  let level = entries;
  for (const step of path) {
    let entry = level.find((e) => e.key === step.key);
    if (!entry) {
      entry = {
        key: step.key,
        level: step.level,
        name: writtenName(step, options, lists),
        children: [],
      };
      level.push(entry);
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
 * say. Each photo's country, state and city are the custom ones first; a level a photo doesn't
 * have is skipped, so a city with no state sits right under its country. A hidden entry's entries
 * move up into the one above it.
 */
export function placesIndex(
  photos: Record<string, unknown>[],
  lists: CaptionLists,
  options: GeneratedPage,
): IndexEntry[] {
  const entries: IndexEntry[] = [];
  for (const photo of photos) {
    for (const path of photoPaths(photo, lists)) {
      insert(entries, shownSteps(path, options), options, lists);
    }
  }
  return options.order === "book" ? entries : sorted(entries);
}

/** How many entries there are, at every level. */
export function entryCount(entries: IndexEntry[]): number {
  return entries.reduce((n, e) => n + 1 + entryCount(e.children), 0);
}
