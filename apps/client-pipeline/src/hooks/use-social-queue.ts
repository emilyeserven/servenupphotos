import { useMemo, useState } from "react";
import type { SocialCalendar } from "@/api/publish";
import { isoDate } from "@/lib/calendar";
import { instagramPostsByDay } from "@/lib/social-post-days";
import { photosByDay, unsavedFromEdits, withoutUndecided } from "@/lib/social-schedule";
import { type SocialQueue, socialQueue, withPostDays } from "@/lib/social-queue";
import { useChangedPhotoFiles } from "@/stores/combined-data";
import { useLocalEditsStore } from "@/stores/local-edits";

/**
 * The Instagram queue from today as the Instagram page has it: without Undecided photos, with the
 * dates not committed yet. A day counts when it's on the calendar or a photo has an Instagram post
 * on it in its Social media posts, planned or scheduled. shown is how many of the next photos to
 * list.
 */
export function useSocialQueue(calendar: SocialCalendar, shown: number): SocialQueue {
  const changed = useChangedPhotoFiles();
  const edits = useLocalEditsStore((state) => state.edits);
  // Read the clock once, as the calendar does.
  const [today] = useState(() => isoDate(new Date()));
  return useMemo(() => {
    const { photos } = withoutUndecided(calendar.photos, changed);
    const calendarDays = photosByDay(photos, unsavedFromEdits(edits));
    const byDay = withPostDays(calendarDays, photos, instagramPostsByDay(photos, changed));
    return socialQueue(byDay, today, shown);
  }, [calendar.photos, changed, edits, today, shown]);
}
