import { settingEntries, settingMutations } from "@/api/data-files";

/**
 * A Not Stored post file: a day something went up on Instagram whose photo isn't in the portfolio,
 * so the Instagram calendar and the Social Feed preview keep its place in the feed. Commit combines
 * them into NOTSTORED.json.
 */
export interface NotStoredPost {
  /** The day, as YYYY-MM-DD, which names the file. */
  id: string;
  /** The day it went up on Instagram, the same as `id`. */
  day: string;
  /** A few words on what was posted, such as "Story repost"; "" for none. */
  note: string;
}

function isNotStoredPost(value: unknown): value is NotStoredPost {
  return typeof (value as Partial<NotStoredPost> | null)?.day === "string";
}

/** The Not Stored posts as the next Commit will have them: NOTSTORED.json with the changes since. */
export const notStoredPosts = settingEntries("notstored", isNotStoredPost);

const notStoredMutations = settingMutations<NotStoredPost>("notstored");

/** Saves a day's Not Stored post, new or with a changed note, as a change waiting for Commit. */
export const saveNotStoredMutation = notStoredMutations.save;

/** Removes a day's Not Stored post, as a change waiting for Commit. */
export const deleteNotStoredMutation = notStoredMutations.remove;
