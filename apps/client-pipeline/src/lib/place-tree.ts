import type { Place } from "@/api/places";

/** A place as a row of the Places table: how deep it sits under its parents, and whether it has places in it. */
export interface PlaceTreeRow {
  place: Place;
  depth: number;
  hasChildren: boolean;
}

function byName(a: Place, b: Place): number {
  return a.name.localeCompare(b.name);
}

/** The places in each place, by the parent's ID, sorted by name. A place whose parent is missing is at the top (""). */
function childrenByParent(places: Place[]): Map<string, Place[]> {
  const ids = new Set(places.map((place) => place.id));
  const children = new Map<string, Place[]>();
  for (const place of places.toSorted(byName)) {
    const parent = shownParent(place, ids);
    children.set(parent, [...(children.get(parent) ?? []), place]);
  }
  return children;
}

/** The place's parent ID, or "" when it has none or its parent isn't there. */
function shownParent(place: Place, ids: Set<string>): string {
  const parent = place.parent ?? "";
  return ids.has(parent) ? parent : "";
}

/**
 * Every place as a table row, each parent followed by the places in it, sorted by name. The places in
 * a collapsed place are left out. Places caught in a loop of parents, which saving refuses, still get
 * a row at the top.
 */
export function placeTreeRows(places: Place[], collapsed: ReadonlySet<string>): PlaceTreeRow[] {
  const children = childrenByParent(places);
  const rows: PlaceTreeRow[] = [];
  const seen = new Set<string>();
  const visit = (place: Place, depth: number) => {
    seen.add(place.id);
    const inside = children.get(place.id) ?? [];
    rows.push({ place, depth, hasChildren: inside.length > 0 });
    const shown = collapsed.has(place.id) ? [] : inside;
    for (const child of shown.filter((c) => !seen.has(c.id))) visit(child, depth + 1);
  };
  for (const place of children.get("") ?? []) visit(place, 0);
  const looped = places.filter((place) => inLoop(place, places)).toSorted(byName);
  for (const place of looped.filter((p) => !seen.has(p.id))) visit(place, 0);
  return rows;
}

/** Whether going up the place's parents comes back around instead of reaching the top. */
function inLoop(place: Place, places: Place[]): boolean {
  const byId = new Map(places.map((p) => [p.id, p]));
  const passed = new Set<string>();
  let at: Place | undefined = place;
  while (at && !passed.has(at.id)) {
    passed.add(at.id);
    at = byId.get(at.parent ?? "");
  }
  return at !== undefined;
}

/** The IDs of every place that has places in it, which Collapse all closes. */
export function parentIds(places: Place[]): Set<string> {
  return new Set(places.map((place) => place.parent ?? "").filter(Boolean));
}
