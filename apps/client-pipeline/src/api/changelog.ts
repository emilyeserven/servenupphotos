import { infiniteQueryOptions } from "@tanstack/react-query";
import { requestJson } from "@/api/request";

/** One change on the base branch: usually a squash-merged pull request, or a commit pushed straight to it. */
export interface ChangelogEntry {
  /** The commit's full ID. */
  sha: string;
  /** The first line of the commit message, without the " (#434)" GitHub adds to a squash merge. */
  title: string;
  /** The number of the pull request the commit merged, when it names one. */
  pullRequest?: number;
  /** The pull request's page on GitHub, when there is one. */
  pullRequestUrl?: string;
  /** The commit's page on GitHub. */
  commitUrl: string;
  /** The GitHub login of who wrote the change, or the commit's author name. */
  author: string;
  /** When the change landed on the branch, as RFC 3339. */
  date: string;
  /** True for a merged photo data pull request ("Add photo data"), which changes photos rather than code. */
  photoData: boolean;
}

/** One page of the Changelog, newest first, without merge commits. */
export interface ChangelogPage {
  /** The repository from Settings, as owner/name. */
  repo: string;
  /** The base branch the changes are on. */
  branch: string;
  entries: ChangelogEntry[];
  /** The page with older changes, or 0 when this is the last. */
  nextPage: number;
}

/** The Changelog, a page of 100 commits at a time from GitHub, with older pages loaded by "Load older changes". */
export const changelogQuery = infiniteQueryOptions({
  queryKey: ["changelog"],
  queryFn: ({ pageParam }) => requestJson<ChangelogPage>(`/api/changelog?page=${pageParam}`),
  initialPageParam: 1,
  getNextPageParam: (last: ChangelogPage) => last.nextPage || undefined,
  // The branch only changes when a pull request is merged, so don't read it again on every visit.
  staleTime: 5 * 60_000,
});
