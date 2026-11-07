import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { socialCalendarQuery } from "@/api/publish";
import { type PlannedPhoto, withScheduled } from "@/lib/instagram-planned";
import { socialPostsToSave } from "@/lib/social-posts";
import { useLocalEditsStore } from "@/stores/local-edits";

/** The photo last marked scheduled, with its `socialPosts` from before, so it can be undone. */
interface Marked {
  path: string;
  name: string;
  before: Record<string, unknown>;
  posts: unknown;
}

/**
 * Marks a planned photo's Instagram post scheduled, as a local edit of its `socialPosts` the sync
 * button counts and **Commit** saves, and undoes the last one. `before` is the file as the
 * Instagram calendar read it, as the calendar's own edits keep it.
 */
export function useMarkScheduled() {
  const read = useQuery(socialCalendarQuery).data?.photos;
  const setField = useLocalEditsStore((state) => state.setField);
  const [last, setLast] = useState<Marked | null>(null);

  const mark = (planned: PlannedPhoto, caption: string) => {
    const { path, data, name } = planned.file;
    const before = read?.find((photo) => photo.path === path)?.data ?? data;
    const value = socialPostsToSave(withScheduled(planned, caption));
    setField("socialPosts", [{ path, before, value }]);
    setLast({ path, name, before, posts: data.socialPosts ?? null });
  };
  const undo = () => {
    if (!last) return;
    setField("socialPosts", [{ path: last.path, before: last.before, value: last.posts }]);
    setLast(null);
  };
  return { mark, undo, last: last?.name ?? null };
}
