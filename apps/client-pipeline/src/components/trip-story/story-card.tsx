import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteTripStoryMutation,
  saveTripStoryMutation,
  storyId,
  type TripStory,
} from "@/api/trip-stories";
import type { Trip } from "@/api/trips";
import { Busy, RemoveEntryButton, SaveNote } from "@/components/entry-buttons";
import { LeftOut } from "@/components/trip-story/left-out";
import { StoryRows } from "@/components/trip-story/story-rows";
import { StoryText } from "@/components/trip-story/story-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripDay } from "@/lib/trip-days";
import { storyDraft, storyOf, type StoryDraft } from "@/lib/trip-story";

interface StoryCardProps {
  day: TripDay;
  /** The day's saved story, if it has one. */
  story?: TripStory;
  /** Every Trip, to say which Trip page the day goes on. */
  trips: Trip[];
}

/** Which Trip page the day's story goes on: its Trip's, or else one of its own. */
function pageNote(day: string, trips: Trip[]): string {
  const trip = trips.find((t) => t.start <= day && day <= t.end);
  if (trip) return `It goes on the "${trip.name}" Trip page with the other days of that Trip.`;
  return "This day is in no Trip, so it gets a Trip page of its own. Add it to a Trip on the Trips tab to gather it with other days.";
}

/**
 * The day's story for the portfolio's Trip page, on the day's Story page: a caption on each photo, a
 * paragraph between photos, and which photos share a row. Saving it is a change waiting for Commit,
 * which builds the Trip pages.
 */
export function StoryCard({ day, story, trips }: StoryCardProps) {
  const [draft, setDraft] = useState<StoryDraft>(() => storyDraft(day, story));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trip page story</CardTitle>
        <CardDescription>
          The words around this day&apos;s photos on the portfolio&apos;s Trip page, shown with the
          Albums, all in Markdown. A photo&apos;s text goes under it as a caption, or beside it as a
          paragraph on its left or right, and can be its Comment from the Photo page. A paragraph
          between photos spans the page. Link photos to put them side by side in a row, up to 4.{" "}
          {pageNote(day.day, trips)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <StoryText
          label="Before the first photo"
          addLabel="Add an opening paragraph"
          value={draft.intro}
          onChange={(intro) => setDraft({ ...draft, intro })}
        />
        <StoryRows draft={draft} onChange={setDraft} />
        <LeftOut draft={draft} onChange={setDraft} />
        <StoryActions day={day} draft={draft} saved={story} onReset={setDraft} />
      </CardContent>
    </Card>
  );
}

interface StoryActionsProps {
  day: TripDay;
  draft: StoryDraft;
  saved?: TripStory;
  onReset: (draft: StoryDraft) => void;
}

/** Saves the story, or removes it to take the day off its Trip page, as changes waiting for Commit. */
function StoryActions({ day, draft, saved, onReset }: StoryActionsProps) {
  const save = useMutation(saveTripStoryMutation);
  const remove = useMutation(deleteTripStoryMutation);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={save.isPending} onClick={() => save.mutate(storyOf(day.day, draft))}>
        <Busy busy={save.isPending} />
        Save story
      </Button>
      {saved && (
        <RemoveEntryButton
          label="Remove story"
          remove={{
            ...remove,
            mutate: () =>
              remove.mutate(storyId(day.day), {
                onSuccess: () => onReset(storyDraft(day, undefined)),
              }),
          }}
        />
      )}
      <SaveNote
        error={save.error}
        why={saved ? "" : "Not saved yet, so the day has no Trip page."}
      />
    </div>
  );
}
