import type { TripPoint, TripSegment } from "@/api/trip-lines";
import type { GapDraft, ViaKey } from "@/lib/trip-gaps";

/** A via point with where it is in the draft: the list after `key`, at `index`. */
export interface PlacedVia {
  key: ViaKey;
  index: number;
  point: TripPoint;
}

/** The via lists' keys in the order the route reaches them: the start spot, then each photo. */
function routeKeys(draft: GapDraft, segments: TripSegment[]): ViaKey[] {
  const keys = ["start", ...segments.flatMap((s) => s.photos.map(String))];
  const rest = Object.keys(draft.via ?? {}).filter((k) => !keys.includes(k));
  return [...new Set([...keys, ...rest])];
}

/** Every via point in the draft, in the order the route goes through them, as the map numbers them. */
export function viasInRouteOrder(draft: GapDraft, segments: TripSegment[]): PlacedVia[] {
  return routeKeys(draft, segments).flatMap((key) =>
    (draft.via?.[key] ?? []).map((point, index) => ({ key, index, point })),
  );
}

/** The draft with a via point taken out of its list. */
function without(draft: GapDraft, { key, index }: PlacedVia): GapDraft {
  const list = (draft.via?.[key] ?? []).filter((_, i) => i !== index);
  return { ...draft, via: { ...draft.via, [key]: list } };
}

/** The draft with point put in the list after key, at index. */
function inserted(draft: GapDraft, key: ViaKey, index: number, point: TripPoint): GapDraft {
  const list = [...(draft.via?.[key] ?? [])];
  list.splice(index, 0, point);
  return { ...draft, via: { ...draft.via, [key]: list } };
}

/**
 * The draft with the via point at position i in route order moved one place earlier (-1) or later
 * (+1): swapped with its neighbor in the same list, or moved into the neighbor's list just before or
 * after it, so the route goes through it there. The draft as it was at either end.
 */
export function movedInRoute(
  draft: GapDraft,
  ordered: PlacedVia[],
  i: number,
  step: -1 | 1,
): GapDraft {
  const via = ordered[i];
  const next = ordered[i + step];
  if (!via || !next) return draft;
  return inserted(without(draft, via), next.key, landing(via, next, step), via.point);
}

/**
 * Where a via point moved past next lands in next's list: next's own place when they share a list
 * (the moved one is taken out first), or else just before or after it.
 */
function landing(via: PlacedVia, next: PlacedVia, step: -1 | 1): number {
  if (next.key === via.key || step === -1) return next.index;
  return next.index + 1;
}
