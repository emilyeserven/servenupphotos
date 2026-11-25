import type { AlbumSuggestions } from "@/api/album-suggestions";
import { type Group, groupId } from "@/api/organize";
import type { ViewerLikes } from "@/api/viewer-likes";
import { clamp } from "@portfolio/lib/values";

/** A photo liked in enough of the chosen Like lists, and who liked it. */
export interface SharedLike {
  /** The photo's ID. */
  id: number;
  /** The names of the people whose lists have it, in the order the lists were given. */
  people: string[];
}

/** The fewest lists a photo has to be in, from 1 to how many lists there are; every list unless it says fewer. */
export function clampAtLeast(atLeast: number | undefined, lists: number): number {
  if (lists === 0) return 0;
  if (atLeast === undefined || !Number.isFinite(atLeast)) return lists;
  return clamp(Math.round(atLeast), 1, lists);
}

/**
 * The overlapping Likes: the photos in at least `atLeast` of the Like lists (every list unless it
 * says fewer), the ones in the most lists first, then by photo ID.
 */
export function sharedLikes(viewers: ViewerLikes[], atLeast?: number): SharedLike[] {
  const fewest = clampAtLeast(atLeast, viewers.length);
  const people = new Map<number, string[]>();
  for (const viewer of viewers) {
    for (const id of new Set(viewer.photos))
      people.set(id, [...(people.get(id) ?? []), viewer.name]);
  }
  return [...people]
    .filter(([, names]) => names.length >= fewest)
    .map(([id, names]) => ({ id, people: names }))
    .toSorted((a, b) => b.people.length - a.people.length || a.id - b.id);
}

/** What grouping reads from a photo: where it was taken and what it shows. */
export interface PhotoFacts {
  id: number;
  /** The city it shows, the custom one first; "" when it has none. */
  city: string;
  /** The country it shows, the custom one first; "" when it has none. */
  country: string;
  /** Its tag IDs. */
  tags: string[];
  /** Its genre IDs. */
  genres: string[];
}

/**
 * How the chosen photos are grouped into suggested albums: all in one album (the default), or split
 * by location or by theme.
 */
export type GroupBy = "one" | "location" | "theme";

/** What a suggested group is made from; "all" is every chosen photo, in one album. */
export type GroupSource = "all" | "city" | "country" | "tag" | "genre" | "none";

/** A group of the chosen photos to suggest as an album. */
export interface SuggestedGroup {
  /** Unique among the groups, such as `city:amsterdam|netherlands` or `tag:canal`. */
  key: string;
  /** The album name it suggests, such as "Amsterdam" or "Canals". */
  name: string;
  source: GroupSource;
  /** The IDs of its photos, lowest first. */
  photos: number[];
}

/** The name the one album of every chosen photo starts with. */
const ONE_ALBUM_NAME = "Shared Likes";

/** Every chosen photo in one suggested album, named "Shared Likes" to start with; none when there are no photos. */
export function oneAlbum(photos: number[]): SuggestedGroup[] {
  if (photos.length === 0) return [];
  return [
    { key: "all", name: ONE_ALBUM_NAME, source: "all", photos: photos.toSorted((a, b) => a - b) },
  ];
}

/** The name of photos that have nothing to group by. */
const LEFT_OVER = { location: "No location", theme: "Other themes" } as const;

/** The groups, the largest first, then by name, with the left-over group last. */
function ordered(groups: SuggestedGroup[]): SuggestedGroup[] {
  return groups.toSorted(
    (a, b) =>
      Number(a.source === "none") - Number(b.source === "none") ||
      b.photos.length - a.photos.length ||
      a.name.localeCompare(b.name),
  );
}

/** A group of the photos, their IDs lowest first. */
function group(key: string, name: string, source: GroupSource, photos: PhotoFacts[]) {
  return { key, name, source, photos: photos.map((p) => p.id).toSorted((a, b) => a - b) };
}

/** The photos by a key, each list in the order given; photos whose key is "" are left out. */
function byKey(photos: PhotoFacts[], keyOf: (photo: PhotoFacts) => string) {
  const out = new Map<string, PhotoFacts[]>();
  for (const photo of photos) {
    const key = keyOf(photo);
    if (key) out.set(key, [...(out.get(key) ?? []), photo]);
  }
  return out;
}

/**
 * The photos grouped by where they were taken: one group per city with at least two of them, the
 * rest by their country, and the photos with neither in "No location".
 */
export function groupByLocation(photos: PhotoFacts[]): SuggestedGroup[] {
  const cities = byKey(photos, (p) => (p.city ? `${p.city}|${p.country}` : ""));
  const groups: SuggestedGroup[] = [];
  const rest: PhotoFacts[] = [];
  for (const [key, list] of cities) {
    if (list.length >= 2) groups.push(group(`city:${key}`, list[0]!.city, "city", list));
    else rest.push(...list);
  }
  rest.push(...photos.filter((p) => !p.city));
  for (const [country, list] of byKey(rest, (p) => p.country)) {
    groups.push(group(`country:${country}`, country, "country", list));
  }
  const none = rest.filter((p) => !p.country);
  if (none.length > 0) groups.push(group("none", LEFT_OVER.location, "none", none));
  return ordered(groups);
}

/**
 * Takes groups from the photos, each time the label the most of them share (at least two), until
 * none is shared by two; returns the groups and the photos left.
 */
function greedy(
  photos: PhotoFacts[],
  labelsOf: (photo: PhotoFacts) => string[],
  source: "tag" | "genre",
  nameOf: (source: "tag" | "genre", id: string) => string,
) {
  const groups: SuggestedGroup[] = [];
  let left = photos;
  for (;;) {
    const best = [...byLabel(left, labelsOf)]
      .filter(([, list]) => list.length >= 2)
      .toSorted(([a, la], [b, lb]) => lb.length - la.length || a.localeCompare(b))[0];
    if (!best) return { groups, left };
    const [label, list] = best;
    groups.push(group(`${source}:${label}`, nameOf(source, label), source, list));
    left = left.filter((p) => !list.includes(p));
  }
}

/** The photos under each of their labels; a photo with two labels is under both. */
function byLabel(photos: PhotoFacts[], labelsOf: (photo: PhotoFacts) => string[]) {
  const out = new Map<string, PhotoFacts[]>();
  for (const photo of photos) {
    for (const label of new Set(labelsOf(photo)))
      out.set(label, [...(out.get(label) ?? []), photo]);
  }
  return out;
}

/**
 * The photos grouped by what they show: first by the tag most of them share, again and again while
 * a tag is shared by two or more, then the rest the same way by genre, and the photos left in
 * "Other themes". Each photo is in one group.
 */
export function groupByTheme(
  photos: PhotoFacts[],
  nameOf: (source: "tag" | "genre", id: string) => string,
): SuggestedGroup[] {
  const tagged = greedy(photos, (p) => p.tags, "tag", nameOf);
  const genred = greedy(tagged.left, (p) => p.genres, "genre", nameOf);
  const none = genred.left;
  const groups = [...tagged.groups, ...genred.groups];
  if (none.length > 0) groups.push(group("none", LEFT_OVER.theme, "none", none));
  return ordered(groups);
}

/** An ID such as `street-food` as a name: "Street food". */
export function idAsName(id: string): string {
  const words = id.replace(/-+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The album a suggested name is: an existing one with that ID or name (ignoring case), or a new one. */
export function albumFor(
  name: string,
  albums: Pick<Group, "id" | "name">[],
): { id: string; existing: boolean } {
  const id = groupId(name);
  const lower = name.trim().toLowerCase();
  const found = albums.find((a) => a.id === id || a.name.trim().toLowerCase() === lower);
  return found ? { id: found.id, existing: true } : { id, existing: false };
}

/** A suggested album as the review left it. */
export interface ReviewedAlbum {
  name: string;
  /** The IDs of the photos still ticked in it. */
  photos: number[];
}

/**
 * What to save from the reviewed albums: the new ones to make, described with who liked their
 * photos and hidden on the portfolio when `made.hidden` says so, and the albums each photo file
 * goes in. Albums with no name that can be an ID, or no
 * photos, are left out, and so are photos with no saved file.
 */
export function sharedAlbumsToSave(
  reviewed: ReviewedAlbum[],
  paths: ReadonlyMap<number, string>,
  albums: Pick<Group, "id" | "name">[],
  made: { description: string; hidden: boolean },
): AlbumSuggestions {
  const newAlbums = new Map<string, AlbumSuggestions["newAlbums"][number]>();
  const photos = new Map<string, Set<string>>();
  for (const album of reviewed) {
    const { id, existing } = albumFor(album.name, albums);
    const files = album.photos.flatMap((p) => paths.get(p) ?? []);
    if (!id || files.length === 0) continue;
    if (!existing) newAlbums.set(id, { id, name: album.name.trim(), ...made });
    for (const path of files) photos.set(path, (photos.get(path) ?? new Set()).add(id));
  }
  return {
    newAlbums: [...newAlbums.values()],
    photos: [...photos].map(([path, ids]) => ({ path, albums: [...ids] })),
  };
}
