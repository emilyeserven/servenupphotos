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
}

/** Saves a new album or tag as JSON in the open photo data pull request, or a new one. */
export const createGroupMutation = (kind: GroupKind) =>
  mutationOptions({
    mutationKey: ["organize", kind, "create"],
    meta: {
      pushes: true,
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
