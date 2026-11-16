/** A spot on the map, as MapLibre gives it on a right-click. */
export interface MapSpot {
  /** Degrees north of the equator, from -90 to 90. */
  lat: number;
  /** Degrees east of Greenwich, any number, as MapLibre keeps counting past 180 when the map wraps. */
  lng: number;
}

/**
 * The spot as "latitude, longitude" with six decimals (about 10 cm), the way Google Maps and most
 * map apps take a pasted position. The longitude is brought back between -180 and 180, as a map
 * scrolled around the world past the date line gives one outside it.
 */
export function formatCoordinates({ lat, lng }: MapSpot): string {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return `${lat.toFixed(6)}, ${wrapped.toFixed(6)}`;
}
