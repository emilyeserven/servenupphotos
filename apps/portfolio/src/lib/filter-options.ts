import { albums, type Group, subAlbums, tags } from "@/lib/groups";
import {
  localizeName,
  localizePlace,
  placeAncestry,
  placeById,
  type Localized,
} from "@/lib/localize";
import { type FilterKey, type LocationKey, matchesFilters } from "@/lib/photo-filters";
import type { Photo } from "@/lib/photos";

/** One choice of a filter's dropdown. */
export interface FilterOption {
  key: FilterKey;
  value: string;
  /** The name, written each way the menu's Script Display can choose. */
  label: Localized;
  /** How deep it is in its tree: 0 at the top, 1 for a city in a country, and so on. */
  depth: number;
  /** How many photos it would show, given the other filters. */
  count: number;
}

/** A country, city or place in the location tree, with what's in it. */
interface LocationNode {
  key: LocationKey;
  value: string;
  children: Map<string, LocationNode>;
}

/** The child of the node for the key and value, added when it isn't there yet. */
function childOf(node: LocationNode, key: LocationKey, value: string): LocationNode {
  const id = `${key}:${value}`;
  const found = node.children.get(id) ?? { key, value, children: new Map() };
  node.children.set(id, found);
  return found;
}

/** The country and city of the photo, then each of its places from the least specific down. */
function locationPaths(photo: Photo): [LocationKey, string][][] {
  const top: [LocationKey, string][] = [];
  if (photo.country) top.push(["country", photo.country]);
  if (photo.city) top.push(["city", photo.city]);
  const chains = photo.placeIds.map((id) =>
    placeAncestry(id)
      .toReversed()
      .map((place): [LocationKey, string] => ["place", place.id]),
  );
  return chains.length > 0 ? chains.map((chain) => [...top, ...chain]) : [top];
}

/** Every country, city and place the photos have, as a tree. */
function locationTree(list: Photo[]): LocationNode {
  const root: LocationNode = { key: "country", value: "", children: new Map() };
  for (const path of list.flatMap(locationPaths)) {
    path.reduce((node, [key, value]) => childOf(node, key, value), root);
  }
  return root;
}

/** The same name every way, for albums and tags, which aren't localized. */
function sameEveryWay(name: string): Localized {
  return { english: name, romanized: name, phonetic: name, native: name };
}

/** A country, city or place's name, written each way. */
function locationLabel({ key, value }: LocationNode): Localized {
  if (key !== "place") return localizeName(key, value);
  const place = placeById(value);
  return place ? localizePlace(place) : sameEveryWay(value);
}

/** The tree's nodes, each followed by what's in it, sorted by their English names. */
function flatten(
  node: LocationNode,
  depth = 0,
): { node: LocationNode; label: Localized; depth: number }[] {
  return [...node.children.values()]
    .map((child) => ({ node: child, label: locationLabel(child), depth }))
    .toSorted((a, b) => a.label.english.localeCompare(b.label.english))
    .flatMap((entry) => [entry, ...flatten(entry.node, depth + 1)]);
}

/** How many of the photos the filter's choice matches. */
function countOf(facet: Photo[], key: FilterKey, value: string): number {
  return facet.filter((photo) => matchesFilters(photo, { [key]: value })).length;
}

/**
 * The location filter's choices: every country the photos were taken in, the cities in each and
 * the places in each city, each place under the place it's in. `facet` is the photos the album
 * and tag filters leave, which the counts are out of.
 */
export function locationOptions(list: Photo[], facet: Photo[]): FilterOption[] {
  return flatten(locationTree(list)).map(({ node, label, depth }) => ({
    key: node.key,
    value: node.value,
    label,
    depth,
    count: countOf(facet, node.key, node.value),
  }));
}

/** An album or tag as a choice, and, for an album, its sub-albums after it. */
function groupOptions(
  key: "album" | "tag",
  group: Group,
  facet: Photo[],
  depth: number,
): FilterOption[] {
  const option = {
    key,
    value: group.id,
    label: sameEveryWay(group.name),
    depth,
    count: countOf(facet, key, group.id),
  };
  const children = key === "album" ? subAlbums(group.id) : [];
  return [option, ...children.flatMap((album) => groupOptions(key, album, facet, depth + 1))];
}

/** The album filter's choices: every album, each sub-album under its parent. */
export function albumOptions(facet: Photo[]): FilterOption[] {
  const known = new Set(albums.map((album) => album.id));
  // An album whose parent isn't an album goes at the top, so it isn't lost.
  const top = albums.filter((album) => !known.has(album.parent ?? "") || album.parent === album.id);
  return top.flatMap((album) => groupOptions("album", album, facet, 0));
}

/** The tag filter's choices: every tag. */
export function tagOptions(facet: Photo[]): FilterOption[] {
  return tags.flatMap((tag) => groupOptions("tag", tag, facet, 0));
}
