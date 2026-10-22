import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { InFlightPullRequest, PublishResult } from "@/api/photos";
import { requestJson } from "@/api/settings";

/** A way of organizing photos. Each album or tag is one JSON file, and photos list them by ID. */
export type GroupKind = "albums" | "tags";

/** How each kind is named and where CI combines its files. */
export const GROUP_KINDS: Record<GroupKind, { singular: string; plural: string; allFile: string }> =
  {
    albums: { singular: "album", plural: "albums", allFile: "ALLALBUMS.json" },
    tags: { singular: "tag", plural: "tags", allFile: "ALLTAGS.json" },
  };

/** One album or tag file. */
export interface Group {
  id: string;
  name: string;
  description?: string;
  /** An album's parent album's ID; absent for a top-level album, and for every tag. */
  parent?: string;
  path: string;
  fileUrl: string;
  /** True when it's only in the photo data pull request, not merged yet. */
  inFlight: boolean;
  /** Why the file couldn't be read; `id` is then its file name. */
  error?: string;
}

/** Every album and tag on the base branch and in the open photo data pull request. */
export interface OrganizeResponse {
  repo: string;
  folder: string;
  branch: string;
  pullRequest: Pick<InFlightPullRequest, "number" | "url" | "branch" | "title"> | null;
  albums: Group[];
  tags: Group[];
}

export const organizeQuery = queryOptions({
  queryKey: ["organize"],
  queryFn: () => requestJson<OrganizeResponse>("/api/organize"),
  retry: false,
});

/** A new album or tag. */
interface NewGroup {
  id: string;
  name: string;
  description: string;
  /** An album's parent album's ID. */
  parent?: string;
}

/** Saves a new album or tag as JSON in the open photo data pull request, or a new one. */
export const createGroupMutation = (kind: GroupKind) =>
  mutationOptions({
    mutationKey: ["organize", kind, "create"],
    meta: { pushes: true },
    mutationFn: (group: NewGroup) =>
      requestJson<PublishResult>(`/api/organize/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(group),
      }),
  });

/**
 * name as an album or tag ID, matching the backend's rule of lowercase letters and numbers with
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
 * The album or tag that already has `id` or `name`, ignoring case, since albums and tags share
 * one set of names so a photo's never collide.
 */
export function findCollision(
  data: OrganizeResponse,
  field: "id" | "name",
  value: string,
): { kind: GroupKind; group: Group } | undefined {
  const wanted = value.trim().toLowerCase();
  if (!wanted) return undefined;
  for (const kind of ["albums", "tags"] as const) {
    const group = data[kind].find((g) => g[field].trim().toLowerCase() === wanted);
    if (group) return { kind, group };
  }
  return undefined;
}

/** Where saving to the photo data pull request committed, as one commit. */
interface CommitResult {
  branch: string;
  commitSha: string;
  commitUrl: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
  /** True when saving opened the pull request. */
  newPullRequest: boolean;
}

/** What moving an album did; nothing is committed when it already had that parent. */
interface AlbumParentResult extends Partial<CommitResult> {
  path: string;
  fileUrl: string;
  changed: boolean;
}

/** Moves the album `id` into the album `parent`, or to the top level when it's null. */
export const setAlbumParentMutation = mutationOptions({
  mutationKey: ["organize", "albums", "parent"],
  meta: { pushes: (result) => (result as AlbumParentResult).changed },
  mutationFn: ({ id, parent }: { id: string; parent: string | null }) =>
    requestJson<AlbumParentResult>(`/api/organize/albums/${encodeURIComponent(id)}/parent`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parent }),
    }),
});

/** A photo's albums and tags, by ID, as its JSON lists them. */
export interface PhotoGroups {
  albums: string[];
  tags: string[];
}

export const NO_GROUPS: PhotoGroups = { albums: [], tags: [] };

/** The albums and tags saved in a photo's JSON; ones that aren't lists of IDs count as none. */
export function savedGroups(data: Record<string, unknown> | undefined): PhotoGroups {
  return { albums: idList(data?.albums), tags: idList(data?.tags) };
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/** data with groups as its "albums" and "tags", where it has them, or else last. */
export function withGroups<T extends object>(data: T, groups: PhotoGroups) {
  return { ...data, albums: groups.albums, tags: groups.tags };
}

/** Whether a and b list the same albums and tags in the same order. */
export function sameGroups(a: PhotoGroups, b: PhotoGroups): boolean {
  return sameIds(a.albums, b.albums) && sameIds(a.tags, b.tags);
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

interface PhotoGroupsResult extends CommitResult {
  /** How many photo files changed; the others already had the albums and tags. */
  files: number;
}

/** Adds albums and tags to the photo files at `paths`, as one commit in the photo data pull request. */
export const addPhotoGroupsMutation = mutationOptions({
  mutationKey: ["photos", "groups"],
  meta: { pushes: true },
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

/** What to call an album or tag: its name, or its ID when it has none. */
export function groupLabel(group: Group): string {
  return group.name || group.id;
}
