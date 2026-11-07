import { settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";

/** One photo of a day's story, with the words around it on the portfolio's Trip page. */
export interface StoryPhoto {
  /** The photo's ID. */
  id: number;
  /** The photo's own text (Markdown): its caption, or a paragraph beside it. */
  text?: string;
  /** Shows the photo's Comment from the Photo page in place of `text`, kept in step with it. */
  useComment?: boolean;
  /** Where the text goes: left out, under the photo as a caption; or a paragraph to its left or right. */
  textSide?: "left" | "right";
  /** Puts the next photo in the same row as this one, side by side. */
  withNext?: boolean;
  /** A paragraph (Markdown) after the photo, across the page, which ends its row. */
  after?: string;
}

/**
 * A day's story file, `story-<day>.json` in the trip lines folder: the words around the day's
 * photos on the portfolio's Trip page, and which photos share a row. Commit gathers each Trip's
 * days' stories into one Trip page (TRIPPAGES.json); a day in no Trip gets a page of its own.
 */
export interface TripStory {
  /** "story-" and the day, such as "story-2026-09-23", also its file name. */
  id: string;
  /** The day, such as "2026-09-23". */
  date: string;
  /** A paragraph (Markdown) before the day's first photo. */
  intro?: string;
  /** The photos the page shows for the day, in order; a photo left out isn't shown. */
  photos: StoryPhoto[];
}

/** The ID of a day's story file. */
export function storyId(day: string): string {
  return `story-${day}`;
}

function isTripStory(value: unknown): value is TripStory {
  const story = value as Partial<TripStory> | null;
  return (
    typeof story?.id === "string" && story.id.startsWith("story-") && Array.isArray(story.photos)
  );
}

/** The days' stories as the next Commit will have them, by day. */
export function tripStories(data: CombinedData): Map<string, TripStory> {
  const entries: unknown[] = (data.head ?? data.base).triplines?.data ?? [];
  return new Map(entries.filter(isTripStory).map((story) => [story.date, story]));
}

const storyMutations = settingMutations<TripStory>("triplines", "tripstories");

/** Saves a day's story, new or changed, as a change waiting for Commit. */
export const saveTripStoryMutation = storyMutations.save;

/** Removes a day's story, taking the day off its Trip page, as a change waiting for Commit. */
export const deleteTripStoryMutation = storyMutations.remove;
