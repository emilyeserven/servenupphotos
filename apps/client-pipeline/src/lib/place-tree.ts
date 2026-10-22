import type { Place } from "@/api/places";

/**
 * The place, then each place above it, nearest first, stopping before one comes around again
 * (`looped`), which saving refuses.
 */
export function placeChain(place: Place, places: Place[]): { chain: Place[]; looped: boolean } {
  const byId = new Map(places.map((p) => [p.id, p]));
  const chain: Place[] = [];
  let at: Place | undefined = place;
  while (at && !chain.includes(at)) {
    chain.push(at);
    at = byId.get(at.parent ?? "");
  }
  return { chain, looped: at !== undefined };
}
