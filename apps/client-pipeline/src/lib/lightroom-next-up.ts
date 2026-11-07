import { LIGHTROOM_STAGES, type LightroomAlbum, type LightroomStage } from "@/lib/lightroom-albums";

/** Whether you have the internet, so any album can be worked on, or only the albums Lightroom keeps offline. */
export type LightroomConnection = "online" | "offline";

/** How many albums each list of the Next up panel suggests. */
const TOP = 3;

/** How far along the album is: 0 for Cull Round 1 up to Re-editing, and -1 for no stage. */
function stageRank(album: LightroomAlbum): number {
  return album.stage ? LIGHTROOM_STAGES.indexOf(album.stage) : -1;
}

/** Fewer photos first, so quicker albums come up sooner; albums without a count go after the ones with one. */
function bySize(a: LightroomAlbum, b: LightroomAlbum): number {
  return (a.photoCount ?? Infinity) - (b.photoCount ?? Infinity);
}

/** Whether the album has photos to work on: not one Lightroom shows with 0. Albums with no count read are kept. */
function hasPhotos(album: LightroomAlbum): boolean {
  return album.photoCount !== 0;
}

/** Whether the album can be opened now: any album online, only the ones kept offline without the internet. */
function reachable(album: LightroomAlbum, connection: LightroomConnection): boolean {
  return connection === "online" || album.offline;
}

/** The albums that can be worked on now: not Done, with photos, and kept offline when there's no internet. */
function workable(albums: LightroomAlbum[], connection: LightroomConnection): LightroomAlbum[] {
  return albums.filter(
    (album) => album.stage !== "Done" && hasPhotos(album) && reachable(album, connection),
  );
}

/**
 * The 3 albums to work on next: the ones furthest along first, so started albums get finished before new ones begin,
 * and the ones with fewer photos first at the same stage. Albums with no stage come last.
 */
export function topOverall(albums: LightroomAlbum[], connection: LightroomConnection) {
  return workable(albums, connection)
    .toSorted((a, b) => stageRank(b) - stageRank(a) || bySize(a, b))
    .slice(0, TOP);
}

/** The stages the per-stage lists cover, in order, with no stage (null) last. Done has nothing left to do. */
export const NEXT_UP_STAGES: (LightroomStage | null)[] = [
  ...LIGHTROOM_STAGES.filter((stage) => stage !== "Done"),
  null,
];

/** The 3 albums at one stage (or with none) to work on next, the ones with fewer photos first. */
export function topAtStage(
  albums: LightroomAlbum[],
  connection: LightroomConnection,
  stage: LightroomStage | null,
) {
  return workable(albums, connection)
    .filter((album) => album.stage === stage)
    .toSorted(bySize)
    .slice(0, TOP);
}
