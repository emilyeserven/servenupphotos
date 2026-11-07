/** A GeoJSON MultiPolygon's coordinates: polygons of rings of [longitude, latitude]. */
type Shape = [number, number][][][];

/**
 * How far, in meters, the circle drawn around a place with no area reaches: about a city block, so
 * it reads as the place's surroundings rather than one more pin.
 */
const PLACE_CIRCLE_M = 80;

/** How many corners the circle's outline has. */
const CORNERS = 48;

/** Meters in one degree of latitude. */
const M_PER_DEGREE = 111_320;

/**
 * The outline of a circle radius meters around a spot, as a MultiPolygon's coordinates, for a place
 * that has a position but no area. Longitude degrees shrink toward the poles, so they're stretched
 * by the latitude to keep the circle round on the map.
 */
export function circleShape(longitude: number, latitude: number, radius = PLACE_CIRCLE_M): Shape {
  const dLat = radius / M_PER_DEGREE;
  const dLng = dLat / Math.cos((latitude * Math.PI) / 180);
  const ring = Array.from({ length: CORNERS + 1 }, (_, i): [number, number] => {
    const angle = ((i % CORNERS) / CORNERS) * 2 * Math.PI;
    return [longitude + dLng * Math.cos(angle), latitude + dLat * Math.sin(angle)];
  });
  return [[ring]];
}
