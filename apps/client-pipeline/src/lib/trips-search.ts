import { useNavigate, useSearch } from "@tanstack/react-router";

/** The Trips page's search, so a link opens the Trip it names. */
export interface TripsSearch {
  /** The ID of the Trip chosen; the newest unless set. */
  trip?: string;
}

/** Reads the Trips page's search, leaving out anything it doesn't know. */
export function parseTripsSearch(search: Record<string, unknown>): TripsSearch {
  const trip = search.trip;
  return typeof trip === "string" && trip ? { trip } : {};
}

/**
 * The Trip the URL names and a way to choose another, replacing the history entry so the back
 * button leaves the page rather than stepping through each click.
 */
export function useTripsSearch() {
  const search = useSearch({ from: "/trips" });
  const navigate = useNavigate({ from: "/trips" });
  const set = (patch: TripsSearch) =>
    void navigate({ search: (s: TripsSearch) => ({ ...s, ...patch }), replace: true });
  return { search, set };
}
