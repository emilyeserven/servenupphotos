import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type AlbumPick,
  pickAlbumPhotosMutation,
  previewAlbumSuggestionsMutation,
} from "@/api/album-suggestions";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { placesQuery, readEntries } from "@/api/places";
import { AlbumSuggestionReview } from "@/components/album-suggestions/album-suggestion-review";
import { CopyPromptButton, PickBar, usePhotoPick } from "@/components/bulk-tagging/pick-controls";
import { defaultBulkTagCount } from "@/components/bulk-tagging/pick-count";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import { ErrorNote } from "@/components/error-note";
import { PasteAnswer } from "@/components/paste-answer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import { albumPrompt } from "@/lib/album-prompt";
import { useCombinedData } from "@/stores/combined-data";

/**
 * Album Suggestions: picks up to the chosen number of related photos without an album (5 at first,
 * up to 50), copies one prompt asking which albums, existing or new, they belong in, and reads the
 * LLM's JSON answer back into a review of the albums before they're saved.
 */
export function AlbumSuggestionsCard() {
  const { pick, bar } = usePhotoPick(pickAlbumPhotosMutation, defaultBulkTagCount);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Album suggestions</CardTitle>
        <CardDescription>
          Picks up to the chosen number of photos (up to 50) that aren&apos;t in an album and go
          together: one, then the ones that share its tags first, then its places, city or country,
          genres or date. Copy one prompt for all of them into a chat with an LLM, which suggests
          existing albums or new ones, paste its JSON answer back, and review the albums before
          they&apos;re saved, waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PickBar {...bar} />
        <ErrorNote error={pick.error} />
        {pick.data && <PickedAlbums key={pick.submittedAt} pick={pick.data} />}
      </CardContent>
    </Card>
  );
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedAlbums({ pick }: { pick: AlbumPick }) {
  const paths = pick.photos.map((photo) => photo.path);
  const preview = useMutation(previewAlbumSuggestionsMutation);
  const pasted = usePastedAnswer((answer) => preview.mutateAsync({ paths, answer }));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {pick.withoutAlbum} of {pick.photoFiles} photos aren&apos;t in an album yet.
      </p>
      <PickedPhotos photos={pick.photos} />
      <CopyAlbumPromptButton pick={pick} />
      <PasteAnswer pasted={pasted} label="Review the albums" />
      {pasted.answer && (
        <AlbumSuggestionReview key={pasted.reviews} preview={pasted.answer} pick={pick} />
      )}
    </div>
  );
}

/** Copies the prompt for every picked photo, with the albums to reuse and the names that are taken. */
function CopyAlbumPromptButton({ pick }: { pick: AlbumPick }) {
  const organize = useQuery(organizeQuery);
  const places = useQuery(placesQuery);
  const combined = useCombinedData();
  const data = organize.data;
  const prompt = () =>
    data
      ? albumPrompt(
          pick.photos,
          { ...data, metaGroups: metaGroups(combined.data) },
          readEntries(places.data?.places),
        )
      : "";
  return (
    <CopyPromptButton
      label={`Copy the album prompt for ${pick.photos.length} photos`}
      disabled={!data}
      prompt={prompt}
    />
  );
}
