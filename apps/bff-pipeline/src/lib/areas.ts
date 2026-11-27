/**
 * The area search's answers: OpenStreetMap places with an outline, such as a park, a neighbourhood
 * or a city, so photos without an exact spot can be shown in the area they were taken in rather
 * than at a made-up point. Turns Nominatim's and Wikidata's answers into areas; `area-finder.ts`
 * asks the servers.
 */

/** The most areas one search answers. */
export const MAX_AREAS = 8;

/** The most points an area's outline may have; a bigger one is left out. */
export const MAX_POINTS = 5000;

/**
 * A GeoJSON MultiPolygon's coordinates: polygons, each an outer ring then any holes, each ring
 * [longitude, latitude] points ending where it starts.
 */
export type Shape = [number, number][][][];

/** One area found, with its outline, as `GET /api/areas` answers it. */
export interface Area {
  /** What it's called, such as "Osaka Castle Park". */
  name: string;
  /** Where it is, as Nominatim writes it in full. */
  place: string;
  /** What sort of area it is, such as "park" or "city". */
  kind: string;
  /** Its OpenStreetMap ID, such as "R358674" for a relation. */
  osm: string;
  /** Its outline. */
  shape: Shape;
}

/** The part of one Nominatim answer read. */
export interface NominatimPlace {
  name?: string;
  display_name?: string;
  type?: string;
  addresstype?: string;
  osm_type?: string;
  osm_id?: number;
  geojson?: { type?: string; coordinates?: unknown };
}

/** Whether query is a Wikidata item ID, such as Q1490. */
export function isWikidataId(query: string): boolean {
  return /^Q[1-9][0-9]*$/.test(query);
}

/** The places that have an outline, as areas, up to MAX_AREAS. */
export function areasOf(places: NominatimPlace[]): Area[] {
  const out: Area[] = [];
  for (const p of places) {
    const shape = shapeOf(p.geojson);
    if (!shape || out.length === MAX_AREAS) continue;
    out.push({
      name: nameOf(p),
      place: p.display_name ?? "",
      kind: kindOf(p),
      osm: osmId(p),
      shape,
    });
  }
  return out;
}

/** v as a point, a [longitude, latitude] pair, or undefined when it isn't numbers. */
function pointOf(v: unknown): [number, number] | undefined {
  if (!Array.isArray(v) || !v.every((n) => typeof n === "number")) return undefined;
  return [v[0] ?? 0, v[1] ?? 0];
}

/** v as a polygon, rings of points, or undefined when it isn't one. */
function polygonOf(v: unknown): [number, number][][] | undefined {
  if (!Array.isArray(v)) return undefined;
  const rings = v.map((ring) => (Array.isArray(ring) ? ring.map(pointOf) : undefined));
  if (rings.some((ring) => !ring || ring.some((point) => !point))) return undefined;
  return rings as [number, number][][];
}

/** The geometry's polygons, or undefined when it isn't a Polygon or MultiPolygon. */
function polygonsOf(geometry: NominatimPlace["geojson"]): Shape | undefined {
  if (geometry?.type === "Polygon") {
    const polygon = polygonOf(geometry.coordinates);
    return polygon && [polygon];
  }
  if (geometry?.type !== "MultiPolygon" || !Array.isArray(geometry.coordinates)) return undefined;
  const polygons = geometry.coordinates.map(polygonOf);
  return polygons.every((p) => p !== undefined) ? polygons : undefined;
}

/**
 * The geometry as a MultiPolygon's coordinates, or undefined when it isn't a polygon, has no
 * points or has more than MAX_POINTS.
 */
export function shapeOf(geometry: NominatimPlace["geojson"]): Shape | undefined {
  const shape = polygonsOf(geometry);
  if (!shape) return undefined;
  const n = pointCount(shape);
  return n > 0 && n <= MAX_POINTS ? shape : undefined;
}

/** How many points the shape has. */
export function pointCount(shape: Shape): number {
  return shape.flat().reduce((n, ring) => n + ring.length, 0);
}

/** The place's name, or else the first part of where it is. */
function nameOf(p: NominatimPlace): string {
  if (p.name) return p.name;
  return (p.display_name ?? "").split(",")[0]!.trim();
}

/** What sort of area the place is: its address type, such as "city", or else its type, such as "park". */
function kindOf(p: NominatimPlace): string {
  return p.addresstype || p.type || "";
}

/** The place's OpenStreetMap ID with its type's letter, such as "R358674". */
function osmId(p: NominatimPlace): string {
  if (!p.osm_type) return "";
  return `${p.osm_type[0]!.toUpperCase()}${p.osm_id ?? 0}`;
}

/** The part of Wikidata's Special:EntityData answer read: each item's claims. */
export interface EntityData {
  entities?: Record<
    string,
    { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }
  >;
}

/** Item id's first OpenStreetMap relation ID (P402), or "". */
export function relationOf(data: EntityData, id: string): string {
  for (const claim of data.entities?.[id]?.claims?.P402 ?? []) {
    const value = claim.mainsnak?.datavalue?.value;
    if (typeof value === "string" && value !== "") return value;
  }
  return "";
}
