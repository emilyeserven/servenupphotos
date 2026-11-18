import type { TripPoint, TripSegment, ViaBy } from "@/api/trip-lines";
import { walkOfKey } from "@/lib/station-walks";
import type { TripPhoto } from "@/lib/trip-days";
import type { DraftVia, GapDraft, ViaKey } from "@/lib/trip-gaps";

/** A spot as [latitude, longitude]. */
type Spot = Pick<TripPoint, "latitude" | "longitude">;

/** The squared distance between a and b, in degrees with longitude shrunk by latitude: only for comparing. */
function nearness(a: Spot, b: Spot): number {
  const dLat = a.latitude - b.latitude;
  const dLng = (a.longitude - b.longitude) * Math.cos((a.latitude * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

/**
 * Where the stretch after key starts: the start spot, the photo, the photo a walk to a station
 * starts from, or the station a walk from one starts at; none when the draft doesn't have it.
 */
function stretchStart(
  key: ViaKey,
  draft: GapDraft,
  photos: TripPhoto[],
  segments: TripSegment[],
): Spot | undefined {
  if (key === "start") return draft.start;
  const walk = walkOfKey(key);
  const id = walk ? walk.a : Number(key);
  if (walk?.end === "alight") return segments.find((s) => s.line && s.photos[0] === id)?.alight;
  return photos.find((p) => p.id === id);
}

/** vias in the order a walk from `from` passes them: each time the nearest one not passed yet. */
function nearestFirst(from: Spot, vias: DraftVia[]): DraftVia[] {
  const left = [...vias];
  const out: DraftVia[] = [];
  let at = from;
  while (left.length > 0) {
    const i = left.reduce(
      (best, v, j) => (nearness(at, v) < nearness(at, left[best]!) ? j : best),
      0,
    );
    const [next] = left.splice(i, 1);
    out.push(next!);
    at = next!;
  }
  return out;
}

/**
 * The draft with the via points of each stretch put in the order a walk passes them: nearest
 * first from where the stretch starts. None moves to another stretch; a stretch whose start isn't
 * known keeps its order.
 */
export function viaInWalkingOrder(
  draft: GapDraft,
  photos: TripPhoto[],
  segments: TripSegment[],
): GapDraft {
  const via = Object.fromEntries(
    Object.entries(draft.via ?? {}).map(([key, list]) => {
      const from = list.length > 1 ? stretchStart(key, draft, photos, segments) : undefined;
      return [key, from ? nearestFirst(from, list) : list];
    }),
  );
  return { ...draft, via };
}

/** Whether putting the via points in walking order would change any. */
export function viaOutOfOrder(
  draft: GapDraft,
  photos: TripPhoto[],
  segments: TripSegment[],
): boolean {
  const ordered = viaInWalkingOrder(draft, photos, segments).via ?? {};
  return Object.entries(draft.via ?? {}).some(([key, list]) =>
    list.some((v, i) => v !== ordered[key]?.[i]),
  );
}

/**
 * The draft with how a walk goes to and from via points set: the one at index after key, or every
 * one after key when index is left out. Left-out `by` lets Snap to streets choose.
 */
export function withViaBy(
  draft: GapDraft,
  key: ViaKey,
  by: ViaBy | undefined,
  index?: number,
): GapDraft {
  const list = (draft.via?.[key] ?? []).map((v, i) => {
    if (index !== undefined && i !== index) return v;
    const { by: _old, ...spot } = v;
    return by ? { ...spot, by } : spot;
  });
  return { ...draft, via: { ...draft.via, [key]: list } };
}

/** How every via point after key goes, when they all say the same; undefined when mixed. */
export function sharedBy(vias: DraftVia[]): ViaBy | "" | undefined {
  const first = vias[0]?.by ?? "";
  return vias.every((v) => (v.by ?? "") === first) ? first : undefined;
}
