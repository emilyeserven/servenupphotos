import type { PlacedPhoto } from "@/lib/map-photos";
import type { TripLinesMap, TripMapFeature } from "@/lib/trip-lines-map";

/** What the map's key lists, as only what the map is drawing now. */
export interface LegendItems {
  /** Whether a photo's own pin, with its thumbnail and an exact spot, is drawn. */
  photo: boolean;
  /** Whether a group's marker can be drawn: there are at least two photos. */
  group: boolean;
  /** Whether a photo without resized versions yet is drawn, as a small light-blue dot. */
  noImage: boolean;
  /** Whether a photo placed by its area rather than an exact spot is drawn, with a faded edge. */
  approximate: boolean;
  /** Whether a day's walk is drawn. */
  walk: boolean;
  /** The colors of the transit lines a hop rode, at most a few, in the order first drawn. */
  rides: string[];
  /** Whether a hop with no transit line picked is drawn, dashed. */
  hop: boolean;
  /** Whether a drive is drawn, in long gray dashes. */
  drive: boolean;
  /** Whether a place visited is drawn, as an amber dot. */
  visit: boolean;
  /** Whether an area is shaded: a trip line's area, or the place picked or pointed at in Places. */
  area: boolean;
}

/** How many transit line colors the key's sample shows. */
const MAX_RIDES = 4;

function isLine(feature: TripMapFeature): boolean {
  return feature.properties.feature === undefined;
}

function isWalk(feature: TripMapFeature): boolean {
  return isLine(feature) && feature.properties.mode === "walk";
}

function isDrive(feature: TripMapFeature): boolean {
  return isLine(feature) && feature.properties.mode === "car";
}

/** Whether the feature is a hop by train, subway, bus or transit: a line that's no walk or drive. */
function isRide(feature: TripMapFeature): boolean {
  return isLine(feature) && !isWalk(feature) && !isDrive(feature);
}

/** A hop's transit line color, or undefined for a walk, a hop without one, or no line at all. */
function rideColor(feature: TripMapFeature): string | undefined {
  return isRide(feature) ? feature.properties.colour : undefined;
}

function isHop(feature: TripMapFeature): boolean {
  return isRide(feature) && feature.properties.colour === undefined;
}

/** The distinct transit line colors of the hops, up to MAX_RIDES. */
function rideColors(features: TripMapFeature[]): string[] {
  const colors = new Set(features.map(rideColor).filter((color) => color !== undefined));
  return [...colors].slice(0, MAX_RIDES);
}

/** Which of the trip lines' kinds the map draws, or none while they're off or not loaded. */
function tripItems(trips: TripLinesMap | undefined) {
  const features = trips?.features ?? [];
  const has = (kind: "visit" | "fence") => features.some((f) => f.properties.feature === kind);
  return {
    walk: features.some(isWalk),
    rides: rideColors(features),
    hop: features.some(isHop),
    drive: features.some(isDrive),
    visit: has("visit"),
    fence: has("fence"),
  };
}

/** Which kinds of photo pin the map draws; a group whenever there are photos enough to make one. */
function pinItems(photos: PlacedPhoto[]) {
  return {
    photo: photos.some((photo) => photo.image !== null && !photo.approximatePosition),
    group: photos.length > 1,
    noImage: photos.some((photo) => photo.image === null),
    approximate: photos.some((photo) => photo.image !== null && photo.approximatePosition),
  };
}

/**
 * What the key lists: the kinds of pin the map draws for its photos, the kinds of trip line it draws
 * under them, and whether a place's area is shaded. Whether they're in view doesn't matter.
 */
export function legendItems(
  photos: PlacedPhoto[],
  trips: TripLinesMap | undefined,
  placeArea: boolean,
): LegendItems {
  const { fence, ...lines } = tripItems(trips);
  return { ...pinItems(photos), ...lines, area: fence || placeArea };
}
