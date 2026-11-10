import type { DayPost } from "@/lib/social-post-days";

/** A post with the day it's on, as the Instagram posts list shows it. */
export interface DatedPost {
  /** The day it posts, as YYYY-MM-DD. */
  day: string;
  post: DayPost;
}

/** The Instagram posts list's tabs: on Instagram already, scheduled there to post, or still planned. */
export type PostTab = "posted" | "scheduled" | "unposted";

/** Which tab a post is in on today (YYYY-MM-DD): planned ones are Unposted whatever their day. */
function tabOf({ day, post }: DatedPost, today: string): PostTab {
  if (post.status === "planned") return "unposted";
  return day <= today ? "posted" : "scheduled";
}

/**
 * Every post sorted into the tabs on today (YYYY-MM-DD): Posted newest first, Scheduled and
 * Unposted soonest first.
 */
export function postsByTab(
  postsByDay: Map<string, DayPost[]>,
  today: string,
): Record<PostTab, DatedPost[]> {
  const tabs: Record<PostTab, DatedPost[]> = { posted: [], scheduled: [], unposted: [] };
  const days = [...postsByDay.keys()].toSorted();
  for (const day of days) {
    for (const post of postsByDay.get(day) ?? []) {
      const dated = { day, post };
      tabs[tabOf(dated, today)].push(dated);
    }
  }
  tabs.posted.reverse();
  return tabs;
}
