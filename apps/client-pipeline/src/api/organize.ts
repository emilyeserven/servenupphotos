import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { InFlightPullRequest, PublishResult } from "@/api/photos";
import { type PendingSave, photoChanges } from "@/api/scan-changes";
import { requestJson } from "@/api/settings";

/**
 * A way of organizing photos: albums, tags and photographic genres. Each one is one JSON file, and
 * photos list them by ID.
 */
export type GroupKind = "albums" | "tags" | "genres";

/** Every kind, in the order the pages list them. */
export const GROUP_KIND_LIST: readonly GroupKind[] = ["albums", "tags", "genres"];

/** How each kind is named and where CI combines its files. */
export const GROUP_KINDS: Record<GroupKind, { singular: string; plural: string; allFile: string }> =
  {
    albums: { singular: "album", plural: "albums", allFile: "ALLALBUMS.json" },
    tags: { singular: "tag", plural: "tags", allFile: "ALLTAGS.json" },
    genres: { singular: "genre", plural: "genres", allFile: "ALLGENRES.json" },
  };

/** One album, tag or genre file. */
export interface Group {
  id: string;
  name: string;
  description?: string;
  /** An album's parent album's ID; absent for a top-level album, and for every tag and genre. */
  parent?: string;
  /** An album's place among the albums, 1 first; absent until the albums are reordered. */
  order?: number;
  /** The IDs of the portfolio's spotlight spots that show an album's photos, such as "homepage". */
  spotlightZones?: string[];
  /**
   * The IDs of an album's photos in the order the portfolio shows them, set on its page; absent or
   * empty for the default order. Photos it leaves out come after the ones it lists.
   */
  photoOrder?: number[];
  path: string;
  fileUrl: string;
  /** True when it's only in the photo data pull request, not merged yet. */
  inFlight: boolean;
  /** Why the file couldn't be read; `id` is then its file name. */
  error?: string;
}

/** Every album, tag and genre on the base branch and in the open photo data pull request. */
export interface OrganizeResponse {
  repo: string;
  folder: string;
  branch: string;
  pullRequest: Pick<InFlightPullRequest, "number" | "url" | "branch" | "title"> | null;
  albums: Group[];
  tags: Group[];
  /** The photographic genres, such as street or landscape. */
  genres: Group[];
}

export const organizeQuery = queryOptions({
  queryKey: ["organize"],
  queryFn: () => requestJson<OrganizeResponse>("/api/organize"),
  retry: false,
});

/** A new album, tag or genre. */
interface NewGroup {
  id: string;
  name: string;
  description: string;
  /** An album's parent album's ID, or a tag's parent tag's ID. */
  parent?: string;
}

/** Saves a new album, tag or genre as JSON, as a change waiting for Commit. */
export const createGroupMutation = (kind: GroupKind) =>
  mutationOptions({
    mutationKey: ["organize", kind, "create"],
    meta: {
      saves: true,
      changes: (result) => {
        const { path, data } = result as PublishResult;
        return [{ kind, path, after: data }];
      },
    },
    mutationFn: (group: NewGroup) =>
      requestJson<PublishResult>(`/api/organize/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(group),
      }),
  });

/** The organize list with a just-made group in it, so it's named before the list is read again. */
export function withNewGroup(
  data: OrganizeResponse | undefined,
  kind: GroupKind,
  group: Group,
): OrganizeResponse | undefined {
  return data && { ...data, [kind]: [...data[kind], group] };
}

/**
 * name as an album, tag or genre ID, matching the backend's rule of lowercase letters and numbers with
 * single dashes between words: accents dropped, and runs of anything else turned into one dash.
 * Empty when the name has no letter or number from a to z or 0 to 9.
 */
export function groupId(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
}

/**
 * name as a new album or tag is saved with: trimmed for an album, and in lowercase kebab-case for
 * a tag, the same as its ID, so "Street Food" is saved as "street-food".
 */
export function groupName(kind: GroupKind, name: string): string {
  return kind === "tags" ? groupId(name) : name.trim();
}

/** The tags whose names aren't their IDs, so aren't in lowercase kebab-case yet. */
export function unnormalizedTags(organize: OrganizeResponse | undefined): Group[] {
  return (organize?.tags ?? []).filter((tag) => !tag.error && tag.name !== tag.id);
}

/**
 * The album, tag or genre that already has `id` or `name`, ignoring case, since they all share
 * one set of names so a photo's never collide.
 */
export function findCollision(
  data: OrganizeResponse,
  field: "id" | "name",
  value: string,
): { kind: GroupKind; group: Group } | undefined {
  const wanted = value.trim().toLowerCase();
  if (!wanted) return undefined;
  for (const kind of GROUP_KIND_LIST) {
    const group = data[kind].find((g) => g[field].trim().toLowerCase() === wanted);
    if (group) return { kind, group };
  }
  return undefined;
}

/** What moving an album did; nothing is saved when it already had that parent. */
interface AlbumParentResult extends PendingSave {
  path: string;
  changed: boolean;
}

/** The album files a save changed, for the combined lists. */
function albumChanges(result: unknown) {
  return (result as PendingSave).changes.map((change) => ({ kind: "albums" as const, ...change }));
}

/** The kinds whose files can name a parent of the same kind: an album's album, or a tag's more general tag. */
export type ParentKind = "albums" | "tags";

/** Whether kind's albums or tags can have a parent; genres can't. */
export function hasParents(kind: GroupKind): kind is ParentKind {
  return kind === "albums" || kind === "tags";
}

/**
 * Moves the album or tag `id` under the one `parent` of the same kind, or to the top level when
 * it's null, as a change waiting for Commit.
 */
export const setGroupParentMutation = (kind: ParentKind) =>
  mutationOptions({
    mutationKey: ["organize", kind, "parent"],
    meta: {
      saves: (result) => (result as AlbumParentResult).changed,
      changes: (result) => (result as PendingSave).changes.map((change) => ({ kind, ...change })),
    },
    mutationFn: ({ id, parent }: { id: string; parent: string | null }) =>
      requestJson<AlbumParentResult>(`/api/organize/${kind}/${encodeURIComponent(id)}/parent`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parent }),
      }),
  });

/** What a change to several albums did; nothing is saved when none of their files changed. */
interface AlbumsResult extends PendingSave {
  /** How many album files changed. */
  files: number;
}

/** The mutation options that PUT a JSON body to `url` and save the album files it changes. */
function albumsMutation<T>(key: string, url: (vars: T) => string, body: (vars: T) => unknown) {
  return mutationOptions({
    mutationKey: ["organize", "albums", key],
    meta: { saves: (result) => (result as AlbumsResult).files > 0, changes: albumChanges },
    mutationFn: (vars: T) =>
      requestJson<AlbumsResult>(url(vars), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body(vars)),
      }),
  });
}

/** Gives each album in `ids` its place there, 1 first, as changes waiting for Commit. */
export const setAlbumOrderMutation = albumsMutation(
  "order",
  () => "/api/organize/albums/order",
  (ids: string[]) => ({ ids }),
);

/**
 * Saves `photoIds`, photo IDs in the order the portfolio shows them, as the album's photo order, a
 * change waiting for Commit. An empty list puts its photos back in the default order.
 */
export const setAlbumPhotoOrderMutation = albumsMutation(
  "photo-order",
  ({ id }: { id: string; photoIds: number[] }) =>
    `/api/organize/albums/${encodeURIComponent(id)}/photo-order`,
  ({ photoIds }) => ({ photoIds }),
);

/** The mutation options that PUT `body` to `/api/organize/tags/<key>` and save the tag files it changes. */
function tagsMutation<T>(key: string, body: (vars: T) => unknown) {
  return mutationOptions({
    mutationKey: ["organize", "tags", key],
    meta: {
      saves: (result) => (result as AlbumsResult).files > 0,
      changes: (result) =>
        (result as PendingSave).changes.map((change) => ({ kind: "tags" as const, ...change })),
    },
    mutationFn: (vars: T) =>
      requestJson<AlbumsResult>(`/api/organize/tags/${key}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body(vars)),
      }),
  });
}

/** Names every tag in lowercase kebab-case, its ID, as changes waiting for Commit. */
export const normalizeTagNamesMutation = tagsMutation<void>("names", () => ({}));

/**
 * Saves each description in `descriptions`, by tag ID, as that tag's description, as changes
 * waiting for Commit. Nothing is saved when an ID isn't a tag.
 */
export const setTagDescriptionsMutation = tagsMutation(
  "descriptions",
  (descriptions: Record<string, string>) => ({ descriptions }),
);

/**
 * Makes `album` the one the spotlight spot `zone` shows, or leaves the spot without one when it's
 * null, as changes waiting for Commit.
 */
export const setSpotlightAlbumMutation = albumsMutation(
  "spotlight",
  ({ zone }: { zone: string; album: string | null }) =>
    `/api/organize/spotlight/${encodeURIComponent(zone)}`,
  ({ album }) => ({ album }),
);

/** A photo's albums, tags and genres, by ID, as its JSON lists them. */
export interface PhotoGroups {
  albums: string[];
  tags: string[];
  /** The photographic genres, such as "street". */
  genres: string[];
}

export const NO_GROUPS: PhotoGroups = { albums: [], tags: [], genres: [] };

/** The albums, tags and genres saved in a photo's JSON; ones that aren't lists of IDs count as none. */
export function savedGroups(data: Record<string, unknown> | undefined): PhotoGroups {
  return { albums: idList(data?.albums), tags: idList(data?.tags), genres: idList(data?.genres) };
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/** data with groups as its "albums", "tags" and "genres", where it has them, or else last. */
export function withGroups<T extends object>(data: T, groups: PhotoGroups) {
  return { ...data, albums: groups.albums, tags: groups.tags, genres: groups.genres };
}

/** Whether a and b list the same albums, tags and genres in the same order. */
export function sameGroups(a: PhotoGroups, b: PhotoGroups): boolean {
  return GROUP_KIND_LIST.every((kind) => sameIds(a[kind], b[kind]));
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

interface PhotoGroupsResult extends PendingSave {
  /** How many photo files changed; the others already had the albums, tags and genres. */
  files: number;
}

/** Adds albums, tags and genres to the photo files at `paths`, as changes waiting for Commit. */
export const addPhotoGroupsMutation = mutationOptions({
  mutationKey: ["photos", "groups"],
  meta: { saves: true, changes: (result) => photoChanges(result as PhotoGroupsResult) },
  mutationFn: (add: PhotoGroups & { paths: string[] }) =>
    requestJson<PhotoGroupsResult>("/api/photos/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(add),
    }),
});

/** The albums from `id` up through its parents, top first; it stops at a missing or repeated one. */
export function albumAncestry(albums: Group[], id: string): Group[] {
  const byId = new Map(albums.map((album) => [album.id, album]));
  const chain: Group[] = [];
  for (
    let at = byId.get(id);
    at && !chain.includes(at);
    at = at.parent ? byId.get(at.parent) : undefined
  ) {
    chain.unshift(at);
  }
  return chain;
}

/** The IDs of the albums inside `id`, at any depth, never `id` itself. */
export function albumDescendants(albums: Group[], id: string): Set<string> {
  const found = new Set<string>();
  const queue = [id];
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    const fresh = childAlbums(albums, at).filter(
      (child) => child.id !== id && !found.has(child.id),
    );
    for (const child of fresh) {
      found.add(child.id);
      queue.push(child.id);
    }
  }
  return found;
}

/** The albums whose parent is `id`, other than itself. */
function childAlbums(albums: Group[], id: string): Group[] {
  return albums.filter((album) => album.parent === id && album.id !== id);
}

/**
 * albums with each one's sub-albums right after it, in the order given, and how deep each is. An
 * album whose parent is missing, or that's in a loop, is listed at the top level.
 */
export function albumTree(albums: Group[]): { group: Group; depth: number }[] {
  const ids = new Set(albums.map((album) => album.id));
  const rows: { group: Group; depth: number }[] = [];
  const placed = new Set<Group>();
  const visit = (album: Group, depth: number) => {
    if (placed.has(album)) return;
    placed.add(album);
    rows.push({ group: album, depth });
    for (const child of childAlbums(albums, album.id)) visit(child, depth + 1);
  };
  for (const album of albums.filter((a) => isTopLevel(a, ids))) visit(album, 0);
  // Then any only reachable through a loop.
  for (const album of albums) visit(album, 0);
  return rows;
}

function isTopLevel(album: Group, ids: ReadonlySet<string>): boolean {
  return !album.parent || !ids.has(album.parent);
}

/** What to call an album, tag or genre: its name, or its ID when it has none. */
export function groupLabel(group: Group): string {
  return group.name || group.id;
}
