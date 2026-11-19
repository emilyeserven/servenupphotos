/** The ID of the map's source of every photo, which MapLibre groups by distance alone. */
export const SOURCE_ID = "photos";

/**
 * Below this zoom, about where a whole country fits on the screen, photos are only grouped with
 * photos from the same country, so a group never mixes photos from neighboring countries. From it
 * in, they're grouped by distance alone.
 */
export const COUNTRY_MAX_ZOOM = 6;

/** What every country source's ID starts with. */
const COUNTRY_SOURCE_PREFIX = `${SOURCE_ID}-country:`;

/**
 * The ID of the map's source of one country's photos, which MapLibre groups on their own. Photos
 * with no country share one source.
 */
export function countrySourceId(country: string | null): string {
  return `${COUNTRY_SOURCE_PREFIX}${country ?? ""}`;
}

/** Whether a map source is one of the photo sources: every photo's or a country's. */
export function isPhotoSource(id: string): boolean {
  return id === SOURCE_ID || id.startsWith(COUNTRY_SOURCE_PREFIX);
}

/**
 * The sources whose groups the map shows at the zoom: the countries' sources, given by their IDs,
 * below COUNTRY_MAX_ZOOM, or else the source of every photo.
 */
export function groupingSources(zoom: number, countrySources: string[]): string[] {
  return zoom < COUNTRY_MAX_ZOOM ? countrySources : [SOURCE_ID];
}

/** The photos split by country, under each country's source ID, in the order they came. */
export function byCountrySource<T extends { country: string | null }>(
  points: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const point of points) {
    const id = countrySourceId(point.country);
    const group = groups.get(id);
    if (group) group.push(point);
    else groups.set(id, [point]);
  }
  return groups;
}
