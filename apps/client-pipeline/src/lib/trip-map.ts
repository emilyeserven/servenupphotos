import type { TripLine } from "@/api/trip-lines";
import type { Trip, TripLeg, TripLegRide } from "@/api/trips";
import { separateRides } from "@/lib/leg-rides";
import { lineFeatures } from "@/components/trip-lines/route-geometry";
import type { TripDay, TripPhoto } from "@/lib/trip-days";
import { endPhoto, endPosition } from "@/lib/trip-legs";
import { orderedPhotos } from "@/lib/trip-order";

/** A longitude and latitude, as GeoJSON writes a point. */
type LngLat = [number, number];

/** One feature of a Trip's map, in the shape of TRIPLINES.geo.json so the portfolio's layers draw it. */
export interface TripMapFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: LngLat[] } | { type: "Point"; coordinates: LngLat };
  properties: { mode?: string; colour?: string; feature?: "photo"; day?: number };
}

/** A Trip's map: its days' lines, its legs, and its days' photos as points. */
export interface TripMapData {
  type: "FeatureCollection";
  features: TripMapFeature[];
}

/** What the Trip's map draws: its days, by day, and their lines. */
export interface TripMapDays {
  /** The Trip's days with photos at an exact spot, first to last. */
  days: TripDay[];
  lines: Map<string, TripLine>;
}

/** The days' lines as the portfolio's layers draw them: a hop's color only when it rode a line. */
function dayLines(day: TripDay, line: TripLine | undefined): TripMapFeature[] {
  if (!line) return [];
  return lineFeatures(line.segments, orderedPhotos(day.photos, line.order)).features.map((f) => ({
    type: "Feature",
    geometry: f.geometry,
    properties: f.properties.onLine
      ? { mode: f.properties.mode, colour: f.properties.colour }
      : { mode: f.properties.mode },
  }));
}

/** The day's photos as points, numbered by the day's place in the Trip. */
function dayPhotos(day: TripDay, n: number): TripMapFeature[] {
  return day.photos.map((p: TripPhoto) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
    properties: { feature: "photo", day: n },
  }));
}

/**
 * to moved a whole turn east or west when that's the shorter way from from, so a flight across the
 * Pacific isn't drawn around the world the other way, as Commit bakes it.
 */
function nearSide(from: LngLat, to: LngLat): LngLat {
  if (to[0] - from[0] > 180) return [to[0] - 360, to[1]];
  if (from[0] - to[0] > 180) return [to[0] + 360, to[1]];
  return to;
}

/** What the map draws a leg as: its mode, and its line's color when it has one. */
function legProps(leg: TripLeg): TripMapFeature["properties"] {
  const colour = leg.line?.colour;
  return colour ? { mode: leg.mode, colour } : { mode: leg.mode };
}

/** The points a leg is drawn through: its line's track, or else straight between its ends. */
function legCoords(leg: TripLeg, start: LngLat, end: LngLat): LngLat[] {
  return leg.path && leg.path.length >= 2 ? leg.path : [start, nearSide(start, end)];
}

/**
 * A leg from where it left to where it arrived, along its line's track in the line's color when
 * one was picked, or else straight; none while an end has no spot.
 */
function legLine(leg: TripLeg, byDay: Map<string, TripDay>): TripMapFeature[] {
  const from = endPosition(leg.from, endPhoto(leg.from, byDay, true));
  const to = endPosition(leg.to, endPhoto(leg.to, byDay, false));
  if (!from || !to) return [];
  const separate = separateRides(leg);
  if (separate) return separate.map((ride) => rideLine(leg, ride));
  const start: LngLat = [from.longitude, from.latitude];
  return [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: legCoords(leg, start, [to.longitude, to.latitude]),
      },
      properties: legProps(leg),
    },
  ];
}

/** A ride of a leg that changed lines, along its track in its line's color. */
function rideLine(leg: TripLeg, ride: TripLegRide & { path: LngLat[] }): TripMapFeature {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: ride.path },
    properties: legProps({ ...leg, line: ride.line }),
  };
}

/** The Trip's map: each day's line and photos, and its legs between them. */
export function tripMapData(trip: Trip, { days, lines }: TripMapDays): TripMapData {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const features = [
    ...days.flatMap((d) => dayLines(d, lines.get(d.day))),
    ...trip.legs.flatMap((leg) => legLine(leg, byDay)),
    ...days.flatMap((d, i) => dayPhotos(d, i + 1)),
  ];
  return { type: "FeatureCollection", features };
}

/**
 * The points the map fits: the days' photos, so a long flight home doesn't zoom the map out to the
 * whole world; the legs' ends when the days have no photos at an exact spot.
 */
export function tripMapPoints(data: TripMapData): LngLat[] {
  const photos = data.features.flatMap((f) =>
    f.geometry.type === "Point" ? [f.geometry.coordinates] : [],
  );
  return photos.length > 0 ? photos : data.features.flatMap((f) => lineCoordinates(f));
}

/** A line feature's points; none for a point. */
function lineCoordinates(f: TripMapFeature): LngLat[] {
  return f.geometry.type === "LineString" ? f.geometry.coordinates : [];
}
