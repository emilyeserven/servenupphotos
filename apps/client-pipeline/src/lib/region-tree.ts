import type { Place } from "@/api/places";
import { type LocationNames, winningName } from "@/lib/location-names";
import {
  type CityRow,
  type CountryRow,
  type StateRow,
  cityOfPlace,
  regionKey,
  stateOfPlace,
} from "@/lib/place-cities";
import { placeChain } from "@/lib/place-tree";

/** What a row of the Places list is: a country, a city in it, or a place in a city or another place. */
export type RegionKind = "country" | "state" | "city" | "place";

/** One country, city or place in the Places list, before it's placed in the tree. */
export interface RegionNode {
  /** Unique across the list, such as `city:seoul` or `place:gyeongbokgung-palace`. */
  key: string;
  kind: RegionKind;
  name: string;
  /** The key of the country, city or place it's listed under; "" at the top. */
  parentKey: string;
  /** How many photos show it. */
  photos: number;
  /** The city, state or country row it's made from; missing for a place. */
  region?: CityRow | StateRow | CountryRow;
  /** The place it's made from; missing for a city or country. */
  place?: Place;
}

/** A node as a row of the Places list: how deep it sits, and whether anything is listed under it. */
export interface RegionTreeRow {
  node: RegionNode;
  depth: number;
  hasChildren: boolean;
  /** The state a city stands in for when they have the same name, such as Seoul in Seoul, shown in one row. */
  state?: RegionNode;
}

/** The key of the country, state or city with this name, or "" when the name is empty. */
function regionNodeKey(kind: "country" | "state" | "city", name: string | undefined): string {
  const key = regionKey(name);
  return key ? `${kind}:${key}` : "";
}

/** The key of the place with this ID. */
function placeNodeKey(id: string): string {
  return `place:${id}`;
}

/** The country of a place: its own, or else the nearest place above it that has one. */
function countryOfPlace(place: Place, places: Place[]): string {
  const countries = placeChain(place, places).chain.map((p) => (p.country ?? "").trim());
  return countries.find(Boolean) ?? "";
}

/**
 * What a place is listed under: the place it's in, or else its city, or else its state, or else its
 * country, each written as the name that wins over it.
 */
function placeParentKey(place: Place, input: RegionTreeInput, ids: Set<string>): string {
  const parent = place.parent ?? "";
  if (ids.has(parent)) return placeNodeKey(parent);
  return placeRegionKey(place, input);
}

/** The key of the city, state or country a place is in, when it's in no listed place. */
function placeRegionKey(place: Place, { places, names }: RegionTreeInput): string {
  const region = (kind: "city" | "state" | "country", name: string) =>
    regionNodeKey(kind, winningName(names, kind, name));
  return (
    region("city", cityOfPlace(place, places)) ||
    region("state", stateOfPlace(place, places)) ||
    region("country", countryOfPlace(place, places))
  );
}

/** The parts of the list the tree is made from. */
export interface RegionTreeInput {
  countries: CountryRow[];
  states: StateRow[];
  cities: CityRow[];
  places: Place[];
  /** How many photos list each place, by ID. */
  placePhotos: ReadonlyMap<string, number>;
  /** The names that win over other names of a country, state or city, which the rows are counted as. */
  names: LocationNames;
}

/** Every country, city and place as a node, each with what it's listed under. */
export function regionNodes(input: RegionTreeInput) {
  const { countries, states, cities, places, placePhotos } = input;
  const ids = new Set(places.map((place) => place.id));
  const nodes: RegionNode[] = [
    ...countries.map((country) => ({
      key: regionNodeKey("country", country.name),
      kind: "country" as const,
      name: country.name,
      parentKey: "",
      photos: country.photos,
      region: country,
    })),
    ...states.map((state) => ({
      key: regionNodeKey("state", state.name),
      kind: "state" as const,
      name: state.name,
      parentKey: regionNodeKey("country", state.country),
      photos: state.photos,
      region: state,
    })),
    ...cities.map((city) => ({
      key: regionNodeKey("city", city.name),
      kind: "city" as const,
      name: city.name,
      parentKey: regionNodeKey("state", city.state) || regionNodeKey("country", city.country),
      photos: city.photos,
      region: city,
    })),
    ...places.map((place) => ({
      key: placeNodeKey(place.id),
      kind: "place" as const,
      name: place.name,
      parentKey: placeParentKey(place, input, ids),
      photos: placePhotos.get(place.id) ?? 0,
      place,
    })),
  ];
  return nodes;
}

const KIND_ORDER: Record<RegionKind, number> = { country: 0, state: 1, city: 2, place: 3 };

/** Countries, then cities, then places, each by name. */
function byKindThenName(a: RegionNode, b: RegionNode): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name);
}

/** The nodes under each node, by its key, sorted. A node whose parent is missing is at the top (""). */
function childrenByParent(nodes: RegionNode[]): Map<string, RegionNode[]> {
  const keys = new Set(nodes.map((node) => node.key));
  const children = new Map<string, RegionNode[]>();
  for (const node of nodes.toSorted(byKindThenName)) {
    const parent = keys.has(node.parentKey) ? node.parentKey : "";
    children.set(parent, [...(children.get(parent) ?? []), node]);
  }
  return children;
}

/** Whether the node's name has the search text in it, ignoring case. */
function nameMatches(node: RegionNode, search: string): boolean {
  return node.name.toLowerCase().includes(search);
}

/** Adds the node and every node above it to shown, stopping at one already there. */
function showWithParents(node: RegionNode, byKey: Map<string, RegionNode>, shown: Set<string>) {
  let at: RegionNode | undefined = node;
  while (at && !shown.has(at.key)) {
    shown.add(at.key);
    at = byKey.get(at.parentKey);
  }
}

/** The keys of the nodes to show for a search: those that match, and every node above one. */
function shownForSearch(nodes: RegionNode[], search: string): Set<string> | undefined {
  if (!search) return undefined;
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const shown = new Set<string>();
  for (const node of nodes) if (nameMatches(node, search)) showWithParents(node, byKey, shown);
  return shown;
}

/** The state the node is listed under when it's a city with the state's name, such as Seoul in Seoul. */
function sameNamedState(node: RegionNode, byKey: Map<string, RegionNode>): RegionNode | undefined {
  if (node.kind !== "city") return undefined;
  const state = byKey.get(node.parentKey);
  return isStateNamed(state, node.name) ? state : undefined;
}

/** Whether the node is a state with the name, counted the way the list counts names. */
function isStateNamed(node: RegionNode | undefined, name: string): node is RegionNode {
  return node?.kind === "state" && regionKey(node.name) === regionKey(name);
}

/** A state and the city with its name that stands in for it. */
interface MergedState {
  state: RegionNode;
  city: RegionNode;
}

/** The node listed under the city instead of the state, or the city listed where the state was. */
function reparented(node: RegionNode, merged: Map<string, MergedState>): RegionNode {
  const pair = merged.get(node.parentKey);
  if (!pair) return node;
  return { ...node, parentKey: pair.city === node ? pair.state.parentKey : pair.city.key };
}

/**
 * The nodes with each state that has a city of its own name, such as Seoul in Seoul, folded into
 * that city: the city takes the state's place, and what was under the state is under the city.
 * `states` holds each such state by its city's key, so the city's row can show both.
 */
function mergeSameNamed(nodes: RegionNode[]) {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const merged = new Map<string, MergedState>();
  for (const city of nodes) {
    const state = sameNamedState(city, byKey);
    if (state) merged.set(state.key, { state, city });
  }
  const states = new Map([...merged.values()].map(({ state, city }) => [city.key, state]));
  const kept = nodes.filter((node) => !merged.has(node.key));
  return { nodes: kept.map((node) => reparented(node, merged)), states };
}

/** How the list is narrowed: which nodes are collapsed, and the search text. */
export interface RegionTreeView {
  collapsed: ReadonlySet<string>;
  /** Only names with this in them, and what they're under, show; "" for every node. */
  search: string;
}

/** Lays the nodes out as rows, depth first, leaving out what's under a collapsed node. */
class RowBuilder {
  readonly rows: RegionTreeRow[] = [];
  readonly seen = new Set<string>();

  constructor(
    private readonly children: Map<string, RegionNode[]>,
    private readonly collapsed: ReadonlySet<string>,
    private readonly isShown: (node: RegionNode) => boolean,
    private readonly states: ReadonlyMap<string, RegionNode>,
  ) {}

  /** Adds the node's row, then the rows under it unless it's collapsed. */
  readonly visit = (node: RegionNode, depth: number) => {
    this.seen.add(node.key);
    const inside = this.shownUnder(node);
    this.rows.push({
      node,
      depth,
      hasChildren: inside.length > 0,
      state: this.states.get(node.key),
    });
    const visit = this.collapsed.has(node.key) ? this.hide : this.visit;
    for (const child of inside) if (!this.seen.has(child.key)) visit(child, depth + 1);
  };

  /** Marks the node and what's under it as reached, without rows, as it's in a collapsed node. */
  readonly hide = (node: RegionNode) => {
    this.seen.add(node.key);
    for (const child of this.shownUnder(node)) if (!this.seen.has(child.key)) this.hide(child);
  };

  /** The nodes under node that the search shows. */
  private shownUnder(node: RegionNode): RegionNode[] {
    return (this.children.get(node.key) ?? []).filter(this.isShown);
  }

  /** Adds a top row for each node not reached yet, such as places caught in a loop of parents. */
  visitLeft(nodes: RegionNode[]) {
    for (const node of nodes.toSorted(byKindThenName)) {
      if (!this.seen.has(node.key) && this.isShown(node)) this.visit(node, 0);
    }
  }
}

/**
 * Every node as a list row, each followed by what's under it: countries, then their cities, then the
 * places in each city and the places in those. A state with a city of its own name shares one row
 * with it. What's under a collapsed node is left out, except while searching. Nodes caught in a loop of parents, which saving refuses, still get a row at the
 * top.
 */
export function regionTreeRows(all: RegionNode[], view: RegionTreeView): RegionTreeRow[] {
  const { nodes, states } = mergeSameNamed(all);
  const children = childrenByParent(nodes);
  const shown = shownForSearch(nodes, view.search.trim().toLowerCase());
  const isShown = (node: RegionNode) => !shown || shown.has(node.key);
  const builder = new RowBuilder(children, shown ? new Set() : view.collapsed, isShown, states);
  builder.visitLeft(children.get("") ?? []);
  builder.visitLeft(nodes);
  return builder.rows;
}

/** The keys of every node that has something under it, which Collapse all closes. */
export function regionParentKeys(all: RegionNode[]): Set<string> {
  const { nodes } = mergeSameNamed(all);
  const keys = new Set(nodes.map((node) => node.key));
  return new Set(nodes.map((node) => node.parentKey).filter((key) => keys.has(key)));
}
