import { sendEvent } from "@/lib/page-views";
import { storedValue } from "@/lib/stored-value";

/** The ids of the photos this browser liked, most recently liked first. */
const likedIds = storedValue<readonly number[]>("servenup-liked-photos", (stored) =>
  Array.isArray(stored) ? stored.filter(Number.isInteger) : [],
);

/**
 * The visitor's own comments on the photos they liked, by photo id. A comment stays when its photo
 * is unliked, so liking it again brings it back.
 */
const likeComments = storedValue<Readonly<Record<string, string>>>(
  "servenup-like-comments",
  (stored) =>
    (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, string>,
);

/** The ids of the photos this browser liked, most recently liked first, updating on each change. */
export const useLikedIds = likedIds.use;

/** Whether this browser liked the photo, updating on each change. */
export function useIsLiked(id: number): boolean {
  return useLikedIds().includes(id);
}

/** Adds the photo to this browser's likes, first in the list, unless it's already there. */
export function like(id: number) {
  const liked = likedIds.get();
  if (liked.includes(id)) return;
  likedIds.set([id, ...liked]);
  sendEvent("like", { photo: String(id) });
}

/** Takes the photo out of this browser's likes. */
export function unlike(id: number) {
  const liked = likedIds.get();
  if (!liked.includes(id)) return;
  likedIds.set(liked.filter((likedId) => likedId !== id));
  sendEvent("unlike", { photo: String(id) });
}

/** The visitor's comments on liked photos, by photo id, updating on each change. */
export const useLikeComments = likeComments.use;

/** Saves the visitor's comment on a liked photo, or removes it when it's blank. */
export function setLikeComment(id: number, comment: string) {
  const others = Object.fromEntries(
    Object.entries(likeComments.get()).filter(([key]) => key !== String(id)),
  );
  likeComments.set(comment.trim() ? { ...others, [id]: comment } : others);
}
