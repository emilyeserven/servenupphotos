import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type GenrePick,
  type GenrePickWhich,
  pickGenrePhotosMutation,
  previewGenreSuggestionsMutation,
} from "@/api/genre-suggestions";
import { organizeQuery } from "@/api/organize";
import { placesQuery, readEntries } from "@/api/places";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import { CopyPromptButton, PickBar, usePhotoPick } from "@/components/bulk-tagging/pick-controls";
import { ContactSheetsButton, usePickedContactSheets } from "@/components/contact-sheets-button";
import {
  GenrePickWhichChoice,
  NO_GENRES_PICK,
} from "@/components/genre-suggestions/genre-pick-which";
import { GenreReview } from "@/components/genre-suggestions/genre-review";
import { PasteAnswer } from "@/components/paste-answer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { genrePrompt } from "@/lib/genre-prompt";
import { ErrorNote } from "@/components/error-note";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import { count } from "@portfolio/lib/words";

/** How many photos Genre Suggestions picks until another number is chosen: a whole batch. */
const defaultGenreCount = 50;

/**
 * Genre Suggestions: picks up to 50 photos without genres (or with genres, to reassign them), copies one prompt asking an LLM for
 * their photographic genres, and reads its JSON answer back into a review of the genres each photo
 * gets and the new genres to make.
 */
export function GenreSuggestionsCard() {
  const [which, setWhich] = useState<GenrePickWhich>(NO_GENRES_PICK);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Genre suggestions</CardTitle>
        <CardDescription>
          Picks a batch of up to 50 photos, in file name order: ones without genres, or ones with
          genres to look at again. Copy one prompt for all of them into a chat with an LLM, which
          picks each photo&apos;s genres from the ones there are (or suggests a new genre, or a new
          subgenre under one there is, when none fits), paste its JSON answer back, and review the
          genres before they&apos;re saved, waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <GenrePickWhichChoice value={which} onChange={setWhich} />
        {/* A new choice of photos starts the pick over. */}
        <GenrePickSection key={`${which.reassign}:${which.genre}`} which={which} />
      </CardContent>
    </Card>
  );
}

/** The pick controls for the chosen photos, then what was picked. */
function GenrePickSection({ which }: { which: GenrePickWhich }) {
  const { pick, bar } = usePhotoPick(pickGenrePhotosMutation, defaultGenreCount, which);
  return (
    <>
      <PickBar {...bar} />
      <ErrorNote error={pick.error} />
      {pick.data && <PickedGenres key={pick.submittedAt} pick={pick.data} which={which} />}
    </>
  );
}

interface PickedGenresProps {
  pick: GenrePick;
  which: GenrePickWhich;
}

/** How many photos the pick was made from, in words. */
function pickedFrom(pick: GenrePick, which: GenrePickWhich): string {
  if (!which.reassign)
    return `${pick.withoutGenres} of ${pick.photoFiles} photos have no genres yet.`;
  const where = which.genre ? "in this genre or its subgenres" : "with genres";
  return `Picked from ${count(pick.matching, "photo")} ${where}; their genres are replaced by the ones you save.`;
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedGenres({ pick, which }: PickedGenresProps) {
  const paths = pick.photos.map((photo) => photo.path);
  const preview = useMutation(previewGenreSuggestionsMutation);
  const pasted = usePastedAnswer((answer) =>
    preview.mutateAsync({ paths, answer, reassign: which.reassign }),
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{pickedFrom(pick, which)}</p>
      <PickedPhotos photos={pick.photos} />
      <CopyGenrePromptButton pick={pick} which={which} />
      <PasteAnswer pasted={pasted} label="Review the genres" />
      {pasted.answer && (
        <GenreReview
          key={pasted.reviews}
          preview={pasted.answer}
          pick={pick}
          reassign={which.reassign}
        />
      )}
    </div>
  );
}

/** Copies the prompt for every picked photo, with the genres there are to choose from. */
function CopyGenrePromptButton({ pick, which }: PickedGenresProps) {
  const organize = useQuery(organizeQuery);
  const places = useQuery(placesQuery);
  const genres = organize.data?.genres;
  const contact = usePickedContactSheets(pick.photos);
  return (
    <>
      <ContactSheetsButton state={contact} />
      <CopyPromptButton
        label={`Copy the genre prompt for ${pick.photos.length} photos`}
        disabled={!genres || contact.pending}
        prompt={() =>
          genrePrompt(pick.photos, {
            genres: genres ?? [],
            places: readEntries(places.data?.places),
            sheets: contact.sheets,
            reassign: which.reassign,
          })
        }
      />
    </>
  );
}
