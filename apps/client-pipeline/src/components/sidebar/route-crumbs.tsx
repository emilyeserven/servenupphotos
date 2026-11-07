import { useQuery } from "@tanstack/react-query";
import { type LinkOptions, useParams, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  type Group,
  type GroupKind,
  groupLabel,
  type OrganizeResponse,
  organizeQuery,
} from "@/api/organize";
import { trips } from "@/api/trips";
import { PART_LABELS } from "@/components/trip-lines/day-page";
import { dayTitle } from "@/components/trip-lines/day-title";
import { NEW_TRIP_ID } from "@/components/trips/trips-panel";
import { isDayPart } from "@/lib/trip-lines-search";
import { useCombinedData } from "@/stores/combined-data";

/** One breadcrumb after the sidebar's pages, such as an album's name. */
export interface Crumb {
  /** What the breadcrumb says. */
  title: string;
  /** Where it opens; the last breadcrumb, the open page, has none. */
  link?: LinkOptions;
}

/**
 * A route's breadcrumbs after the sidebar's pages. A component rather than a list, since some read
 * the album or Trip to name it; it hands its breadcrumbs to `children`, which draws them.
 */
export type RouteCrumbs = (props: { children: (crumbs: Crumb[]) => ReactNode }) => ReactNode;

/** Breadcrumbs that never change, such as Lightroom Albums' "Import". */
export function fixedCrumbs(...titles: string[]): RouteCrumbs {
  const crumbs = titles.map((title) => ({ title }));
  return ({ children }) => children(crumbs);
}

/** An album's breadcrumbs: its parent albums, each a link, then its own name. */
export const AlbumCrumbs: RouteCrumbs = ({ children }) => {
  const { id } = useParams({ from: "/albums/$id" });
  return children(useGroupCrumbs("albums", id));
};

/** A tag's breadcrumb: its name. */
export const TagCrumbs: RouteCrumbs = ({ children }) => {
  const { id } = useParams({ from: "/tags/$id" });
  return children(useGroupCrumbs("tags", id));
};

/** A genre's breadcrumb: its name. */
export const GenreCrumbs: RouteCrumbs = ({ children }) => {
  const { id } = useParams({ from: "/genres/$id" });
  return children(useGroupCrumbs("genres", id));
};

/** The open album's, tag's or genre's name, after the albums it sits in; its ID until they're read. */
function useGroupCrumbs(kind: GroupKind, id: string): Crumb[] {
  const organize = useQuery(organizeQuery);
  const byId = new Map(groupsOf(organize.data, kind).map((g) => [g.id, g]));
  const group = byId.get(id);
  if (!group) return [{ title: id }];
  const parents = parentChain(group, byId).map((p) => ({
    title: groupLabel(p),
    link: { to: "/albums/$id", params: { id: p.id } } as LinkOptions,
  }));
  return [...parents, { title: groupLabel(group) }];
}

function groupsOf(data: OrganizeResponse | undefined, kind: GroupKind): Group[] {
  return data ? data[kind] : [];
}

/** The albums an album sits in, outermost first, stopping at a parent that's missing or repeats. */
function parentChain(group: Group, byId: Map<string, Group>, seen = new Set([group.id])): Group[] {
  const parent = byId.get(group.parent ?? "");
  if (!parent || seen.has(parent.id)) return [];
  seen.add(parent.id);
  return [...parentChain(parent, byId, seen), parent];
}

/** The Trips tab's link, which the Trip Lines breadcrumb leaves out since it opens the Days tab. */
const TRIPS_TAB = { to: "/trip-lines", search: { tab: "trips" } } as LinkOptions;

/** The Trip Lines page's breadcrumb for its Trips tab; nothing on the Days tab. */
export const TripLinesCrumbs: RouteCrumbs = ({ children }) => {
  const tab = useSearch({ from: "/trip-lines/", select: (s) => s.tab });
  return children(tab === "trips" ? [{ title: "Trips" }] : []);
};

/** A Trip's breadcrumbs: the Trips tab, then the Trip's name, or "New Trip" for one not saved yet. */
export const TripCrumbs: RouteCrumbs = ({ children }) => {
  const { id } = useParams({ from: "/trip-lines_/trips/$id" });
  const combined = useCombinedData();
  const trip = trips(combined.data).find((t) => t.id === id);
  return children([{ title: "Trips", link: TRIPS_TAB }, { title: tripTitle(id, trip?.name) }]);
};

function tripTitle(id: string, name: string | undefined): string {
  if (id === NEW_TRIP_ID) return "New Trip";
  return name || id;
}

/** A day's breadcrumbs on Trip Lines: the day, linking to its first page, then the page open. */
export const TripDayCrumbs: RouteCrumbs = ({ children }) => {
  const { day, part } = useParams({ from: "/trip-lines/$day/$part" });
  return children([
    { title: dayTitle(day), link: { to: "/trip-lines/$day", params: { day } } as LinkOptions },
    { title: isDayPart(part) ? PART_LABELS[part] : part },
  ]);
};
