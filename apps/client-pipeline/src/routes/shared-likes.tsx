import { createFileRoute } from "@tanstack/react-router";
import { SharedLikesPage } from "@/components/shared-likes/page";

/**
 * Shared Likes' search: the people whose Like lists are left out (`skip`), the fewest lists a photo
 * has to be in (`atLeast`, every list when missing), and grouping by theme (`by=theme`) rather than
 * location.
 */
interface SharedLikesSearch {
  skip?: string[];
  atLeast?: number;
  by?: "theme";
}

/** The people to leave out, when there are any. */
function parseSkip(value: unknown): Pick<SharedLikesSearch, "skip"> {
  const skip = Array.isArray(value) ? value.filter((s) => typeof s === "string") : [];
  return skip.length > 0 ? { skip } : {};
}

/** The fewest lists, when it's a whole number above 0. */
function parseAtLeast(value: unknown): Pick<SharedLikesSearch, "atLeast"> {
  const atLeast = Number(value);
  return Number.isInteger(atLeast) && atLeast > 0 ? { atLeast } : {};
}

function parseSearch(search: Record<string, unknown>): SharedLikesSearch {
  return {
    ...parseSkip(search.skip),
    ...parseAtLeast(search.atLeast),
    ...(search.by === "theme" ? { by: "theme" as const } : {}),
  };
}

export const Route = createFileRoute("/shared-likes")({
  validateSearch: parseSearch,
  component: SharedLikesPage,
});
