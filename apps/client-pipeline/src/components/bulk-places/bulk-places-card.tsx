import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type BulkPlacePick,
  findPhotosByNameMutation,
  pickBulkPlacePhotosMutation,
} from "@/api/bulk-places";
import type { BulkTagPhoto } from "@/api/bulk-tags";
import { type Place, placesQuery, readEntries } from "@/api/places";
import { BulkPlaceReview } from "@/components/bulk-places/bulk-place-review";
import { NoPlaceFoundNote } from "@/components/bulk-places/no-place-found";
import { CopyPromptButton, PickBar, usePhotoPick } from "@/components/bulk-tagging/pick-controls";
import { defaultBulkTagCount } from "@/components/bulk-tagging/pick-count";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import { ContactSheetsButton, usePickedContactSheets } from "@/components/contact-sheets-button";
import { ErrorNote } from "@/components/error-note";
import { PasteAnswer } from "@/components/paste-answer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import { bulkPlacePrompt, parseBulkPlaceAnswer } from "@/lib/bulk-place-prompt";
import { noPlacePaths, reviewBulkPlaces, unpickedNames } from "@/lib/bulk-places";
import { useNoPlaceFoundStore } from "@/stores/no-place-found";

/**
 * Bulk Places: picks up to the chosen number of related photos without places, copies one prompt
 * asking an LLM where each was taken, with a map link to check it by, and reads its JSON answer back
 * into a review of the place each photo gets and the new places to make.
 */
export function BulkPlacesCard() {
  const noPlaceFound = useNoPlaceFoundStore((state) => state.paths);
  const { pick, bar } = usePhotoPick(pickBulkPlacePhotosMutation, defaultBulkTagCount, {
    noPlaceFound,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk places</CardTitle>
        <CardDescription>
          Picks up to the chosen number of photos (up to 50) without places that go together: one,
          then the ones that share its city or country, genres or date. Copy one prompt for all of
          them into a chat with an LLM, which finds each photo&apos;s place on Google Maps (or Naver
          Map or Kakao Map in South Korea), paste its JSON answer back, and review the places before
          they&apos;re saved, waiting for Commit. An answer can name any photo, not only the picked
          ones: the others are found and reviewed too. Photos the LLM finds no place for are
          remembered in this browser and not picked again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PickBar {...bar} />
        <ErrorNote error={pick.error} />
        {pick.data && <PickedPlaces key={pick.submittedAt} pick={pick.data} />}
      </CardContent>
    </Card>
  );
}

/**
 * The review the pasted answer makes for the picked photos and the ones it names that weren't
 * picked, which `find` looks up among every photo, so an answer for another batch still applies to
 * the photos it names. Throws a sentence a user can read when the answer can't be read.
 */
async function readPlaces(
  answer: string,
  pick: BulkPlacePick,
  places: Place[],
  find: (names: string[]) => Promise<{ photos: BulkTagPhoto[] }>,
) {
  const pasted = parseBulkPlaceAnswer(answer);
  const unpicked = unpickedNames(pick.photos, pasted);
  const others = unpicked.length > 0 ? (await find(unpicked)).photos : [];
  return reviewBulkPlaces(pick.photos, pasted, places, others);
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedPlaces({ pick }: { pick: BulkPlacePick }) {
  const places = useQuery(placesQuery);
  const all = readEntries(places.data?.places);
  const contact = usePickedContactSheets(pick.photos);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {pick.unplaced} of {pick.photoFiles} photos have no places yet.
        <NoPlaceFoundNote count={pick.noPlaceFound} />
      </p>
      <PickedPhotos photos={pick.photos} />
      <ContactSheetsButton state={contact} />
      <CopyPromptButton
        label={`Copy the place prompt for ${pick.photos.length} photos`}
        disabled={!places.data || contact.pending}
        prompt={() => bulkPlacePrompt(pick.photos, all, contact.sheets)}
      />
      <PlacesAnswer pick={pick} places={all} loading={!places.data} />
    </div>
  );
}

interface PlacesAnswerProps {
  pick: BulkPlacePick;
  /** Every place there is now. */
  places: Place[];
  /** True while the places are still loading. */
  loading: boolean;
}

/** The box to paste the answer into, and its review. */
function PlacesAnswer({ pick, places, loading }: PlacesAnswerProps) {
  const find = useMutation(findPhotosByNameMutation);
  const remember = useNoPlaceFoundStore((state) => state.add);
  const pasted = usePastedAnswer(async (answer) => {
    const review = await readPlaces(answer, pick, places, find.mutateAsync);
    remember(noPlacePaths(review));
    return review;
  });
  return (
    <>
      <PasteAnswer pasted={pasted} label="Review the places" disabled={loading} />
      {pasted.answer && <BulkPlaceReview key={pasted.reviews} review={pasted.answer} />}
    </>
  );
}
