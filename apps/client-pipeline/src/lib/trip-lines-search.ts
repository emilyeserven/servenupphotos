import { useNavigate, useSearch } from "@tanstack/react-router";

/** The day list's filters, as the URL writes them. */
const DAY_FILTERS = ["marked", "out-of-date", "automatic", "none"] as const;

/** A day list filter other than All. */
export type DayFilter = (typeof DAY_FILTERS)[number];

/**
 * The Trip Lines page's search, so a link opens the page as it was: which tab, the day chosen,
 * the day list's filter, the group shown alone on the day's map, and the Trip chosen. Each is
 * left out at its default.
 */
export interface TripLinesSearch {
  /** "trips" for the Trips tab; Days unless set. */
  tab?: "trips";
  /** The day chosen, such as "2026-09-23"; the newest unless set. */
  day?: string;
  /** The day list's filter; All unless set. */
  show?: DayFilter;
  /** The name of the group shown alone on the day's map, the others faded. */
  group?: string;
  /** The ID of a Trip chosen on the Trips tab before each Trip had a page; such a link opens its page. */
  trip?: string;
}

/** The value when it's a string that passes test, under key; nothing otherwise. */
function stringParam<K extends keyof TripLinesSearch>(
  key: K,
  value: unknown,
  test: (s: string) => boolean,
): Pick<TripLinesSearch, K> | Record<string, never> {
  return typeof value === "string" && test(value)
    ? ({ [key]: value } as Pick<TripLinesSearch, K>)
    : {};
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isFilter = (s: string) => (DAY_FILTERS as readonly string[]).includes(s);
const isTab = (s: string) => s === "trips";
const isText = (s: string) => s.length > 0;

/** Reads the Trip Lines page's search, leaving out anything it doesn't know. */
export function parseTripLinesSearch(search: Record<string, unknown>): TripLinesSearch {
  return {
    ...stringParam("tab", search.tab, isTab),
    ...stringParam("day", search.day, isDay),
    ...stringParam("show", search.show, isFilter),
    ...stringParam("group", search.group, isText),
    ...stringParam("trip", search.trip, isText),
  };
}

/**
 * The page's search and a way to change part of it, replacing the history entry so the back
 * button leaves the page rather than stepping through each click. A part set to undefined is
 * removed from the URL.
 */
export function useTripLinesSearch() {
  const search = useSearch({ from: "/trip-lines" });
  const navigate = useNavigate({ from: "/trip-lines" });
  const set = (patch: TripLinesSearch) =>
    void navigate({ search: (s: TripLinesSearch) => ({ ...s, ...patch }), replace: true });
  return { search, set };
}
