import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type BulkPlacePick, pickBulkPlacePhotosMutation } from "@/api/bulk-places";
import { type Place, placesQuery, readEntries } from "@/api/places";
import { BulkPlaceReview } from "@/components/bulk-places/bulk-place-review";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import { defaultBulkTagCount } from "@/components/bulk-tagging/pick-count";
import {
  CopyPromptButton,
  ErrorText,
  PasteAnswer,
  PickBar,
  usePhotoPick,
} from "@/components/bulk-tagging/pick-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bulkPlacePrompt, parseBulkPlaceAnswer } from "@/lib/bulk-place-prompt";
import { reviewBulkPlaces } from "@/lib/bulk-places";

/**
 * Bulk Places: picks up to the chosen number of related photos without places, copies one prompt
 * asking an LLM where each was taken, with a map link to check it by, and reads its JSON answer back
 * into a review of the place each photo gets and the new places to make.
 */
export function BulkPlacesCard() {
  const { pick, bar } = usePhotoPick(pickBulkPlacePhotosMutation, defaultBulkTagCount);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk places</CardTitle>
        <CardDescription>
          Picks up to the chosen number of photos (up to 50) without places that go together: one,
          then the ones that share its city or country, genres or date. Copy one prompt for all of
          them into a chat with an LLM, which finds each photo&apos;s place on Google Maps (or Naver
          Map or Kakao Map in South Korea), paste its JSON answer back, and review the places before
          they&apos;re saved, waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PickBar {...bar} />
        <ErrorText error={pick.error} />
        {pick.data && <PickedPlaces key={pick.submittedAt} pick={pick.data} />}
      </CardContent>
    </Card>
  );
}

/** The review the pasted answer makes, or null when it has no list of photos. */
function readAnswer(answer: string, pick: BulkPlacePick, places: Place[]) {
  const pasted = parseBulkPlaceAnswer(answer);
  return { review: pasted && reviewBulkPlaces(pick.photos, pasted, places) };
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedPlaces({ pick }: { pick: BulkPlacePick }) {
  const places = useQuery(placesQuery);
  const all = readEntries(places.data?.places);
  const [answer, setAnswer] = useState("");
  const [read, setRead] = useState<ReturnType<typeof readAnswer>>();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {pick.unplaced} of {pick.photoFiles} photos have no places yet.
      </p>
      <PickedPhotos photos={pick.photos} />
      <CopyPromptButton
        label={`Copy the place prompt for ${pick.photos.length} photos`}
        disabled={!places.data}
        prompt={() => bulkPlacePrompt(pick.photos, all)}
      />
      <PasteAnswer
        value={answer}
        onChange={setAnswer}
        pending={!places.data}
        label="Review the places"
        onReview={() => setRead(readAnswer(answer, pick, all))}
      />
      {read && <ReadAnswer read={read} />}
    </div>
  );
}

/** The review the answer makes, or that it can't be read. */
function ReadAnswer({ read }: { read: ReturnType<typeof readAnswer> }) {
  if (!read.review) {
    return (
      <p className="text-destructive text-sm">
        The answer has no JSON object with a list of photos to read.
      </p>
    );
  }
  return <BulkPlaceReview key={JSON.stringify(read.review)} review={read.review} />;
}
