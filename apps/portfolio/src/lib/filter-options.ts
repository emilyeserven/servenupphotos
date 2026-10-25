import { albums, genres, type Group, subAlbums, tags } from "@/lib/groups";
import {
  localizeName,
  localizePlace,
  placeAncestry,
  placeById,
  type Localized,
} from "@/lib/localize";
import { type FilterKey, type LocationKey, matchesFilters } from "@/lib/photo-filters";
import { groupTree, groupValues, type MetaGroup } from "@/lib/metadata-groups";
import { distinctState, type Photo } from "@/lib/photos";
import type { EquipmentKey } from "@/lib/camera-filters";

/** One choice of a filter's dropdown. */
export interface FilterOption {
  /** The URL search key the choice sets, such as "album". */
  key: string;
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
  const add = (key: LocationKey, value: string | null) => value && top.push([key, value]);
  add("country", photo.country);
  // A state named like its city, such as Seoul in Seoul, is left out so the name isn't nested in itself.
  add("state", distinctState(photo.state, photo.city));
  add("city", photo.city);
  const chains = photo.placeIds.map((id) =>
    placeAncestry(id)
      .toReversed()
      .map((place): [LocationKey, string] => ["place", place.id]),
  );
  return chains.length > 0 ? chains.map((chain) => [...top, ...chain]) : [top];
}

/** Every country, state, city and place the photos have, as a tree. */
function locationTree(list: Photo[]): LocationNode {
  const root: LocationNode = { key: "country", value: "", children: new Map() };
  for (const path of list.flatMap(locationPaths)) {
    path.reduce((node, [key, value]) => childOf(node, key, value), root);
  }
  return root;
}

/** The same name every way, for albums, tags and genres, which aren't localized. */
function sameEveryWay(name: string): Localized {
  return { english: name, romanized: name, phonetic: name, native: name };
}

/** A country, city or place's name, written each way. */
function locationLabel({ key, value }: LocationNode): Localized {
  if (key !== "place") return localizeName(key, value);
  const place = placeById(value);
  return place ? localizePlace(place) : sameEveryWay(value);
}

/** A country, city or place as a choice of the Places filter, with what's in it. */
export interface LocationOption {
  key: LocationKey;
  value: string;
  /** Where it is in the tree, such as "/country:Japan/city:Kyoto", which no other choice has. */
  id: string;
  /** The name, written each way the menu's Script Display can choose. */
  label: Localized;
  /** How many photos it would show, given the other filters. */
  count: number;
  /** What's in it, sorted by their English names. */
  children: LocationOption[];
}

/** How many of the photos the filter's choice matches. */
function countOf(facet: Photo[], key: FilterKey, value: string): number {
  return facet.filter((photo) => matchesFilters(photo, { [key]: value })).length;
}

/** The node's children as choices, sorted by their English names, each with what's in it. */
function childOptions(node: LocationNode, facet: Photo[], path = ""): LocationOption[] {
  return [...node.children.values()]
    .map((child) => ({ child, label: locationLabel(child) }))
    .toSorted((a, b) => a.label.english.localeCompare(b.label.english))
    .map(({ child, label }) => {
      const id = `${path}/${child.key}:${child.value}`;
      return {
        key: child.key,
        value: child.value,
        id,
        label,
        count: countOf(facet, child.key, child.value),
        children: childOptions(child, facet, id),
      };
    });
}

/**
 * The Places filter's choices: every country the photos were taken in, the states in each, the
 * cities in each and the places in each city, each place under the place it's in. `facet` is the photos the other
 * filters leave, which the counts are out of.
 */
export function locationOptions(list: Photo[], facet: Photo[]): LocationOption[] {
  return childOptions(locationTree(list), facet);
}

/** An album, tag or genre as a choice, and, for an album, its sub-albums after it. */
function groupOptions(
  key: "album" | "tag" | "genre",
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

/** The genre filter's choices: every photographic genre. */
export function genreOptions(facet: Photo[]): FilterOption[] {
  return genres.flatMap((genre) => groupOptions("genre", genre, facet, 0));
}

/** Camera or lens names as choices at the depth, each counting the photos taken with it. */
function nameOptions(
  key: EquipmentKey,
  names: string[],
  depth: number,
  facet: Photo[],
): FilterOption[] {
  return names.toSorted().map((name) => ({
    key,
    value: name,
    label: sameEveryWay(name),
    depth,
    count: facet.filter((photo) => photo[key] === name).length,
  }));
}

/** The chosen camera or lens group's ID and the chosen camera or lens's name, when there are. */
interface ChosenEquipment {
  group?: string;
  name?: string;
}

/** Whether the group, or a camera or lens it lists, is the one chosen. */
function holdsChosen(group: MetaGroup, inGroup: Set<string>, chosen: ChosenEquipment): boolean {
  return group.id === chosen.group || inGroup.has(chosen.name ?? "");
}

/**
 * A camera or lens metadata group as a choice, then the names it lists that the photos have; none
 * when it would show no photos, given the other filters, unless it's or it lists the one chosen,
 * so the dropdown still shows it.
 */
function equipmentGroupOptions(
  key: EquipmentKey,
  [group, depth]: [MetaGroup, number],
  names: Set<string>,
  facet: Photo[],
  chosen: ChosenEquipment,
): FilterOption[] {
  const inGroup = groupValues(group);
  const option = {
    key: `${key}Group`,
    value: group.id,
    label: sameEveryWay(group.name),
    depth,
    count: facet.filter((photo) => inGroup.has(photo[key] ?? "")).length,
  };
  if (option.count === 0 && !holdsChosen(group, inGroup, chosen)) return [];
  const listed = [...new Set(group.values.map(String))].filter((name) => names.has(name));
  return [option, ...nameOptions(key, listed, depth + 1, facet)];
}

/**
 * The camera or lens filter's choices: the metadata groups of cameras or lenses, each under the
 * group it's in and followed by the names it lists, then every other camera or lens the photos
 * were taken with, by name. A group that would show none of `facet` is left out, unless it's
 * or it lists the one `chosen`. Photos whose EXIF didn't name a lens aren't under any.
 */
export function equipmentOptions(
  key: EquipmentKey,
  list: Photo[],
  facet: Photo[],
  chosen: ChosenEquipment = {},
): FilterOption[] {
  const names = new Set(list.flatMap((photo) => photo[key] ?? []));
  const tree = groupTree(key);
  const grouped = new Set(tree.flatMap(([group]) => group.values.map(String)));
  return [
    ...tree.flatMap((entry) => equipmentGroupOptions(key, entry, names, facet, chosen)),
    ...nameOptions(
      key,
      [...names].filter((name) => !grouped.has(name)),
      0,
      facet,
    ),
  ];
}
