import { mutationOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import { groupId } from "@/api/organize";
import type { InFlightPullRequest } from "@/api/photos";
import { requestJson } from "@/api/settings";
import type { FileChange } from "@/lib/optimistic";

/** A place file: somewhere photos are taken, more exactly than a city, such as Gyeongbokgung Palace. */
export interface Place {
  id: string;
  name: string;
  description: string;
  /** The ID of the less specific place it's in, such as Gyeongbokgung Palace for Geunjeongmun Gate; "" or missing for none. */
  parent?: string;
  /** Where it is, which a photo given the place takes as its city and country; "" or missing when not set. */
  city?: string;
  country?: string;
  /**
   * The place's GPS position in decimal degrees, which a photo given the place uses on the portfolio's
   * map when its EXIF has none; missing when not set.
   */
  latitude?: number;
  longitude?: number;
  /**
   * Whether the GPS position is exactly where photos given the place were taken, such as a subway
   * station or a museum, so the portfolio's map marks them like photos with their own GPS position;
   * missing when it isn't, or the place has no GPS position.
   */
  exactLocation?: boolean;
}

/** What a localization is of. */
export type LocalizationType = "country" | "city" | "place";

/** A localization file: how a country, city or place is written and said where it is. */
export interface Localization {
  /** `<type>-<name as an ID>`, such as `city-seoul`; a place's is `place-<its ID>`. */
  id: string;
  type: LocalizationType;
  /** The country's or city's name as photos list it, or the place's name. */
  name: string;
  /** The name in Latin letters, such as Gyeongbokgung. */
  romanization: string;
  /** How the local script is read, such as furigana for kanji. */
  pronunciation: string;
  /** The name in its own script, such as 경복궁 in hangeul. */
  localScript: string;
  /**
   * Other ways photos and places write a country or city, such as "United States" for "United
   * States of America". Its name wins over them: Update Data's Location names rewrites them to it.
   */
  otherNames?: string[];
}

/** One place or localization file, as read; `data` is missing when it couldn't be. */
interface EntryFile<T> {
  path: string;
  data?: T;
  error?: string;
}

/** Every place and localization file at the photo data pull request's head, or on the base branch. */
export interface PlacesResponse {
  repo: string;
  folder: string;
  /** Where the files were read. */
  branch: string;
  pullRequest: InFlightPullRequest | null;
  places: EntryFile<Place>[];
  localizations: EntryFile<Localization>[];
}

export const placesQuery = queryOptions({
  queryKey: ["places"],
  queryFn: () => requestJson<PlacesResponse>("/api/places"),
  retry: false,
});

/** The places and localizations that could be read, without their files. */
export function readEntries<T>(files: EntryFile<T>[] | undefined): T[] {
  return (files ?? []).flatMap((file) => (file.data ? [file.data] : []));
}

/** What saving a place or localization did; nothing is saved when it already had that content. */
export interface EntryResult<T> {
  path: string;
  /** The file as saved. */
  data: T;
  /** The file before, or null when it's new. */
  before: T | null;
  changed: boolean;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
}

type EntryKind = "places" | "localizations";

/** The change a save made, for the combined lists; a new file has no `before`. */
function entryChange<T>(kind: EntryKind, result: EntryResult<T>): FileChange[] {
  const { path, data, before } = result;
  return [before === null ? { kind, path, after: data } : { kind, path, before, after: data }];
}

/**
 * Saves a place or localization, new or changed, as a change waiting for Commit. Saves made while
 * one runs are queued and run in order.
 */
function saveEntryMutation<T extends { id: string }>(kind: EntryKind) {
  return mutationOptions({
    mutationKey: [kind, "save"],
    // Each save checks the others' names and parents, so saves wait their turn rather than racing.
    scope: { id: "photo-data-entries" },
    meta: {
      saves: (result) => (result as EntryResult<T>).changed,
      changes: (result) => entryChange(kind, result as EntryResult<T>),
    },
    mutationFn: (entry: T) =>
      requestJson<EntryResult<T>>(`/api/${kind}/${encodeURIComponent(entry.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(entry),
      }),
  });
}

export const savePlaceMutation = saveEntryMutation<Place>("places");
export const saveLocalizationMutation = saveEntryMutation<Localization>("localizations");

/** The read with entry as the file at path, in place of what was there. */
function withEntry<T>(
  read: PlacesResponse,
  kind: EntryKind,
  path: string,
  entry: T,
): PlacesResponse {
  const files = read[kind] as EntryFile<T>[];
  const others = files.filter((file) => file.path !== path);
  return { ...read, [kind]: [...others, { path, data: entry }] };
}

/** Puts a saved place or localization into the cached read, so lists show it without reading again. */
export function cacheSavedEntry<T>(
  queryClient: QueryClient,
  kind: EntryKind,
  result: EntryResult<T>,
) {
  queryClient.setQueryData(
    placesQuery.queryKey,
    (read) => read && withEntry(read, kind, result.path, result.data),
  );
}

/**
 * A save's callbacks that put the place or localization into the cached read as soon as it's
 * queued, so lists show it at once; then what the save wrote once it's done, or a fresh read if it
 * fails.
 */
export function optimisticEntry<T extends { id: string }>(
  queryClient: QueryClient,
  kind: EntryKind,
) {
  return {
    onMutate: async (entry: T) => {
      await queryClient.cancelQueries({ queryKey: placesQuery.queryKey });
      queryClient.setQueryData(
        placesQuery.queryKey,
        (read) => read && withEntry(read, kind, `${read.folder}/${kind}/${entry.id}.json`, entry),
      );
    },
    onSuccess: (result: EntryResult<T>) => cacheSavedEntry(queryClient, kind, result),
    onError: () => queryClient.invalidateQueries({ queryKey: placesQuery.queryKey }),
  };
}

/**
 * name as an ID, the same way album and tag IDs are made; for names with no letter or number from a
 * to z or 0 to 9, such as 東京, its UTF-8 bytes in hex, so every name has one.
 */
export function entryId(name: string): string {
  const id = groupId(name);
  if (id || !name.trim()) return id;
  const bytes = new TextEncoder().encode(name.trim().normalize("NFC"));
  return Array.from(bytes.slice(0, 40), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The ID of the localization of a country, city or place. A place's uses the place's own ID. */
export function localizationId(type: LocalizationType, name: string, placeId?: string): string {
  return `${type}-${placeId ?? entryId(name)}`.slice(0, 100).replace(/-+$/, "");
}

/** How a photo can relate to a place, as a preposition: "In Gyeongbokgung Palace". */
export const RELATIONS = [
  "in",
  "at",
  "by",
  "near",
  "on",
  "inside",
  "outside",
  "behind",
  "in front of",
  "across from",
  "above",
  "below",
  "overlooking",
  "from",
] as const;

/** One place a photo was taken at, by its ID in PLACES.json, and how the photo relates to it. */
export interface PhotoPlace {
  /** One of RELATIONS, or "" for none. */
  relation: string;
  id: string;
}

/** The places saved in a photo's JSON; anything that isn't a list of places counts as none. */
export function savedPlaces(value: unknown): PhotoPlace[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPhotoPlace).map(({ relation, id }) => ({ relation, id }));
}

function isPhotoPlace(value: unknown): value is PhotoPlace {
  const v = value as Partial<PhotoPlace> | null;
  return typeof v?.id === "string" && typeof v.relation === "string";
}

/**
 * The photo's places as a phrase, such as "In Gyeongbokgung Palace by Geunjeongmun Gate", naming
 * each by its place's name, or its ID when it isn't a place.
 */
export function placePhrase(places: PhotoPlace[], names: ReadonlyMap<string, string>): string {
  const phrase = places
    .filter((place) => place.id)
    .map((place) => [place.relation, names.get(place.id) ?? place.id].filter(Boolean).join(" "))
    .join(" ");
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
