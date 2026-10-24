import type { PhotoLocation, PhotoLocationParts } from "@/lib/photos";

/**
 * How much of where a photo was taken the Table's Place column shows, as named in the URL:
 * only the most specific place, all of its place names, those and its city, or those, its city
 * and its country.
 */
export const LOCATION_DETAILS = ["specific", "places", "city", "state", "country"] as const;

export type LocationDetail = (typeof LOCATION_DETAILS)[number];

/** The default, which the URL leaves out: only the most specific place. */
export const DEFAULT_LOCATION_DETAIL: LocationDetail = "specific";

/** Each choice's name in the View menu. */
export const LOCATION_DETAIL_LABELS: Record<LocationDetail, string> = {
  specific: "Most specific",
  places: "All place names",
  city: "Include city",
  state: "Include state",
  country: "Include country",
};

/** The parts each choice shows, most specific first. */
const SHOWN: Record<LocationDetail, (keyof PhotoLocationParts)[]> = {
  specific: ["specific"],
  places: ["places"],
  city: ["places", "city"],
  state: ["places", "city", "state"],
  country: ["places", "city", "state", "country"],
};

/** The location detail the URL names, or undefined for the default. */
export function parseLocationDetail(value: unknown): LocationDetail | undefined {
  const detail = LOCATION_DETAILS.find((name) => name === value);
  return detail === DEFAULT_LOCATION_DETAIL ? undefined : detail;
}

/**
 * The location as the choice shows it, such as "Geunjeongmun Gate" or "Geunjeongmun Gate, Seoul,
 * South Korea". A photo without the parts the choice shows, such as one with no places, shows its
 * city, or else its country, instead.
 */
export function locationText(location: PhotoLocation, detail: LocationDetail): string {
  const { parts } = location;
  const shown = SHOWN[detail].map((key) => parts[key]).filter(Boolean);
  if (shown.length === 0) return parts.city ?? parts.country ?? location.label;
  return shown.join(", ");
}

/** The lines shown on hover: the GPS position, then the country when the text leaves it out. */
export function locationDetails(location: PhotoLocation, detail: LocationDetail): string[] {
  const { gps, state, country } = location.parts;
  const text = locationText(location, detail);
  const missing = (value: string | null) => (value && !text.includes(value) ? value : null);
  const lines = [gps, missing(state), missing(country)];
  return lines.filter((line): line is string => Boolean(line));
}
