import type { TripSegment } from "@/api/trip-lines";
import type { TripPhoto } from "@/lib/trip-days";
import type { GapDraft } from "@/lib/trip-gaps";

/**
 * A group of a day's photos taken one after the other, such as a morning in one park, which is its
 * own named line. It's known by its first photo's ID; `start` and `end` are its photos' indexes.
 */
export interface PhotoGroup {
  key: string;
  start: number;
  end: number;
}

/** The day's groups: its photos split at each photo that starts one. */
export function photoGroups(photos: number[], starts: string[] = []): PhotoGroup[] {
  const at = new Set(starts);
  const firsts = photos.flatMap((id, i) => (i === 0 || at.has(String(id)) ? [i] : []));
  return firsts.map((start, n) => ({
    key: String(photos[start]),
    start,
    end: firsts[n + 1] ?? photos.length,
  }));
}

/** The group the photo is in, by key, for each photo ID. */
function groupOfPhoto(photos: number[], starts?: string[]): Map<number, string> {
  return new Map(
    photoGroups(photos, starts).flatMap((g) =>
      photos.slice(g.start, g.end).map((id) => [id, g.key]),
    ),
  );
}

/** Whether the photo starts a group of its own, given the last place seen. */
function startsPlace(photo: TripPhoto, last: string | undefined): boolean {
  return photo.place !== undefined && photo.place.id !== last;
}

/**
 * The groups the photos' places make: a new one wherever the place changes, named after it. A
 * photo with no place stays in the group before it.
 */
export function placeGroups(photos: TripPhoto[]): Pick<GapDraft, "groups" | "names"> {
  const groups: string[] = [];
  const names: Record<string, string> = {};
  let last: string | undefined;
  photos.forEach((p, i) => {
    if (!startsPlace(p, last)) return;
    last = p.place!.id;
    const key = String(p.id);
    if (i > 0) groups.push(key);
    names[key] = p.place!.name;
  });
  if (photos[0] && !photos[0].place) names[String(photos[0].id)] = "";
  return { groups, names };
}

/** The segment's parts at each group's first photo, with the stretch between them on its own. */
function splitSegment(segment: TripSegment, starts: Set<number>): TripSegment[] {
  const cut = segment.photos.findIndex((id, i) => i > 0 && starts.has(id));
  if (segment.mode !== "walk" || cut === -1) return [segment];
  return [...partBefore(segment, cut), ...betweenAndAfter(segment, cut, starts)];
}

/** The segment's part up to the photo before index at, with the via spots before it. */
function partBefore(segment: TripSegment, at: number): TripSegment[] {
  const photos = segment.photos.slice(0, at);
  const via = (segment.via ?? []).filter(
    (v) => v.after === undefined || photos.slice(0, -1).includes(v.after),
  );
  return [{ ...segment, photos, end: undefined, via }];
}

/** The walk from the photo before index at to the one at it, then the rest, split again. */
function betweenAndAfter(segment: TripSegment, at: number, starts: Set<number>): TripSegment[] {
  const [a, b] = [segment.photos[at - 1] as number, segment.photos[at] as number];
  const via = segment.via ?? [];
  const between: TripSegment = {
    mode: "walk",
    photos: [a, b],
    via: via.filter((v) => v.after === a),
  };
  const rest = {
    ...segment,
    start: undefined,
    photos: segment.photos.slice(at),
    via: via.filter((v) => v.after !== undefined && segment.photos.slice(at).includes(v.after)),
  };
  return [between, ...splitSegment(rest, starts)];
}

/** The segments with each walk split at the first photo of every group but the first. */
export function splitAtGroups(segments: TripSegment[], starts: string[] = []): TripSegment[] {
  const at = new Set(starts.map(Number));
  return segments
    .flatMap((s) => splitSegment(s, at))
    .map(trimmed)
    .filter((s) => pointsIn(s) >= 2);
}

/** How many points the segment's line goes through. */
function pointsIn({ photos, via, start, end }: TripSegment): number {
  return (
    photos.length + (via?.length ?? 0) + Number(start !== undefined) + Number(end !== undefined)
  );
}

/** The segment without the start, end and via spots it was left without. */
function trimmed({ start, end, via, ...rest }: TripSegment): TripSegment {
  return { ...rest, ...spots({ start, end }), ...viaOf(via) };
}

/** The start and end spots there are. */
function spots({ start, end }: Pick<TripSegment, "start" | "end">): Partial<TripSegment> {
  return { ...(start && { start }), ...(end && { end }) };
}

/** The via spots, when there are any. */
function viaOf(via: TripSegment["via"]): Partial<TripSegment> {
  return via?.length ? { via } : {};
}

/** The name of the group all the segment's photos are in; "" when they span two. */
function nameOf(s: TripSegment, byPhoto: Map<number, string>, names: Record<string, string>) {
  const keys = new Set(s.photos.map((id) => byPhoto.get(id)));
  return keys.size === 1 ? (names[[...keys][0] ?? ""] ?? "").trim() : "";
}

/** The segments with the name of the group each is in, where it has one. */
export function withNames(
  segments: TripSegment[],
  photos: number[],
  draft: GapDraft,
): TripSegment[] {
  const byPhoto = groupOfPhoto(photos, draft.groups);
  return segments.map((s) => {
    const name = nameOf(s, byPhoto, draft.names ?? {});
    return name ? { ...s, name } : s;
  });
}

/**
 * The groups and names of saved segments: a group starts at the first photo of each segment whose
 * name differs from the last name seen. None when no segment has a name.
 */
export function groupsOf(segments: TripSegment[]): Pick<GapDraft, "groups" | "names"> {
  const named = segments.filter((s) => s.name && s.photos.length > 0);
  const firsts = named.filter((s, i) => i === 0 || s.name !== named[i - 1]!.name);
  if (firsts.length === 0) return {};
  const keys = firsts.map((s) => String(s.photos[0]));
  const names = Object.fromEntries(firsts.map((s, i) => [keys[i], s.name!]));
  return { groups: keys, names };
}

/** The draft with a group starting at the photo, or the photo's group joined to the one before. */
export function withGroupStart(draft: GapDraft, id: number, starts: boolean): GapDraft {
  const key = String(id);
  const groups = (draft.groups ?? []).filter((g) => g !== key);
  return { ...draft, groups: starts ? [...groups, key] : groups };
}

/** The draft with the group's name changed. */
export function withGroupName(draft: GapDraft, key: string, name: string): GapDraft {
  return { ...draft, names: { ...draft.names, [key]: name } };
}
