import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type GenrePick,
  pickGenrePhotosMutation,
  previewGenreSuggestionsMutation,
} from "@/api/genre-suggestions";
import { organizeQuery } from "@/api/organize";
import { placesQuery, readEntries } from "@/api/places";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import {
  CopyPromptButton,
  ErrorText,
  PasteAnswer,
  PickBar,
  usePhotoPick,
} from "@/components/bulk-tagging/pick-controls";
import { GenreReview } from "@/components/genre-suggestions/genre-review";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { genrePrompt } from "@/lib/genre-prompt";

/** How many photos Genre Suggestions picks until another number is chosen: a whole batch. */
const defaultGenreCount = 50;

/**
 * Genre Suggestions: picks up to 50 photos without genres, copies one prompt asking an LLM for
 * their photographic genres, and reads its JSON answer back into a review of the genres each photo
 * gets and the new genres to make.
 */
export function GenreSuggestionsCard() {
  const { pick, bar } = usePhotoPick(pickGenrePhotosMutation, defaultGenreCount);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Genre suggestions</CardTitle>
        <CardDescription>
          Picks a batch of up to 50 photos without genres, in file name order. Copy one prompt for
          all of them into a chat with an LLM, which picks each photo&apos;s genres from the ones
          there are (or suggests a new one when none fits), paste its JSON answer back, and review
          the genres before they&apos;re saved, waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PickBar {...bar} />
        <ErrorText error={pick.error} />
        {pick.data && <PickedGenres key={pick.submittedAt} pick={pick.data} />}
      </CardContent>
    </Card>
  );
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedGenres({ pick }: { pick: GenrePick }) {
  const [answer, setAnswer] = useState("");
  const paths = pick.photos.map((photo) => photo.path);
  const preview = useMutation(previewGenreSuggestionsMutation);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {pick.withoutGenres} of {pick.photoFiles} photos have no genres yet.
      </p>
      <PickedPhotos photos={pick.photos} />
      <CopyGenrePromptButton pick={pick} />
      <PasteAnswer
        value={answer}
        onChange={setAnswer}
        pending={preview.isPending}
        label="Review the genres"
        onReview={() => preview.mutate({ paths, answer })}
      />
      <ErrorText error={preview.error} />
      {preview.data && (
        <GenreReview key={JSON.stringify(preview.data)} preview={preview.data} pick={pick} />
      )}
    </div>
  );
}

/** Copies the prompt for every picked photo, with the genres there are to choose from. */
function CopyGenrePromptButton({ pick }: { pick: GenrePick }) {
  const organize = useQuery(organizeQuery);
  const places = useQuery(placesQuery);
  const genres = organize.data?.genres;
  return (
    <CopyPromptButton
      label={`Copy the genre prompt for ${pick.photos.length} photos`}
      disabled={!genres}
      prompt={() => genrePrompt(pick.photos, genres ?? [], readEntries(places.data?.places))}
    />
  );
}
