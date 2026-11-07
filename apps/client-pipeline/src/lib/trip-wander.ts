import type { TripPoint } from "@/api/trip-lines";
import type { GapDraft } from "@/lib/trip-gaps";
import { type PhotoGroup, photoGroups } from "@/lib/trip-groups";

/** The indexes of the gaps inside the group: between each two of its photos. */
function innerGaps(group: PhotoGroup): number[] {
  return Array.from({ length: group.end - group.start - 1 }, (_, i) => group.start + i);
}

/** Whether the group was wandered with no set route: two or more photos, every gap between them a wander. */
export function isWandered(draft: GapDraft, group: PhotoGroup): boolean {
  const inner = innerGaps(group);
  return inner.length > 0 && inner.every((i) => draft.gaps[i] === "wander");
}

/** The draft with the group's inner gaps made wanders, or walks again when `on` is false. */
export function withWandered(draft: GapDraft, group: PhotoGroup, on: boolean): GapDraft {
  const inner = new Set(innerGaps(group));
  const gaps = draft.gaps.map((g, i) => (inner.has(i) ? (on ? "wander" : "walk") : g));
  return { ...draft, gaps };
}

/** An area wandered: its group, and the photos the line enters at and leaves from. */
export interface WanderedArea {
  group: PhotoGroup;
  /** The ID of its first photo, which its entrance stands in for. */
  first: string;
  /** The ID of its last photo, which its exit stands in for. */
  last: string;
}

/** The day's groups that were wandered, in order. */
export function wanderedAreas(ids: number[], draft: GapDraft): WanderedArea[] {
  return photoGroups(ids, draft.groups)
    .filter((group) => isWandered(draft, group))
    .map((group) => ({ group, first: String(ids[group.start]), last: String(ids[group.end - 1]) }));
}

/** Which end of a wandered area a spot is, and which photo it stands in for: "entrance:12". */
export type AreaPick = `${"entrance" | "exit"}:${string}`;

/** Where each kind of area end is kept in the draft. */
const FIELD = { entrance: "entrances", exit: "exits" } as const;

/** The draft with the area end `pick` names set to point, or removed when there's none. */
export function withAreaEnd(
  draft: GapDraft,
  pick: AreaPick,
  point: TripPoint | undefined,
): GapDraft {
  const [kind, id] = pick.split(":") as ["entrance" | "exit", string];
  const field = FIELD[kind];
  const { [id]: _old, ...rest } = draft[field] ?? {};
  return { ...draft, [field]: point ? { ...rest, [id]: point } : rest };
}

/** The spot the draft has for the area end `pick` names, if it's set. */
export function areaEndOf(draft: GapDraft, pick: AreaPick): TripPoint | undefined {
  const [kind, id] = pick.split(":") as ["entrance" | "exit", string];
  return draft[FIELD[kind]]?.[id];
}

/** Whether what the map is waiting to have picked is an area's entrance or exit. */
export function isAreaPick(pick: string | undefined): pick is AreaPick {
  return pick?.startsWith("entrance:") === true || pick?.startsWith("exit:") === true;
}
