import type { WheelPoint } from "@/lib/color-wheel";

/**
 * A marker on the color wheel: one photo's pin, or a cluster of photos whose places are too close
 * together to tell apart at this zoom. members are the photos' indexes, in the order given, and at
 * is where it sits: the photo's place, or the middle of its photos' places.
 */
export interface WheelMarker {
  members: number[];
  at: WheelPoint;
}

/** The fewest photos a cluster covers; two close pins are only moved apart. */
const CLUSTER_MIN = 3;

/**
 * The places grouped into markers, like the Map page's clusters: each place, in order, takes every
 * place not yet taken within radius of it (in the places' units), and if that makes
 * CLUSTER_MIN or more they're one cluster. A smaller radius, as when zoomed in, splits clusters
 * apart; a radius of 0 gives every place its own pin.
 */
export function clusterPlaces(places: WheelPoint[], radius: number): WheelMarker[] {
  const taken = new Set<number>();
  const markers: WheelMarker[] = [];
  places.forEach((place, i) => {
    if (taken.has(i)) return;
    const near = nearby(places, place, radius, taken);
    const members = near.length >= CLUSTER_MIN ? near : [i];
    for (const member of members) taken.add(member);
    markers.push({ members, at: middleOf(members.map((m) => places[m]!)) });
  });
  return markers;
}

/** The indexes of places within radius of place, leaving out those already taken. */
function nearby(places: WheelPoint[], place: WheelPoint, radius: number, taken: Set<number>) {
  return places.flatMap((other, i) =>
    !taken.has(i) && Math.hypot(other.x - place.x, other.y - place.y) <= radius ? [i] : [],
  );
}

/** The middle of some points: their average. */
function middleOf(points: WheelPoint[]): WheelPoint {
  const sum = points.reduce((total, p) => ({ x: total.x + p.x, y: total.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
