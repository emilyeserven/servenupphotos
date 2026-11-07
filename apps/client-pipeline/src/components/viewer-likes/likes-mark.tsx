import { useMemo } from "react";
import { viewerLikes, likeCounts } from "@/api/viewer-likes";
import { LikeCount } from "@/components/viewer-likes/most-liked";
import { useCombinedData } from "@/stores/combined-data";

/** How many people liked each photo, by photo ID, as the next Commit will have the user likes. */
export function useLikeCounts(): Map<number, number> {
  const { data } = useCombinedData();
  return useMemo(() => likeCounts(viewerLikes(data)), [data]);
}

/** How many people liked the photo whose JSON is data, by its photo ID. */
function likesOf(data: Record<string, unknown> | undefined, counts: Map<number, number>): number {
  const id = data?.id;
  return typeof id === "number" ? (counts.get(id) ?? 0) : 0;
}

interface LikesMarkProps {
  /** The photo's JSON. */
  data?: Record<string, unknown>;
  counts: Map<number, number>;
}

/** The photo's likes from the User Likes page, by its photo ID; nothing when nobody liked it. */
export function LikesMark({ data, counts }: LikesMarkProps) {
  const count = likesOf(data, counts);
  if (count === 0) return null;
  return <LikeCount count={count} />;
}
