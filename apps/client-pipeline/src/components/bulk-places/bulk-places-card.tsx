import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type BulkPlacePick, pickBulkPlacePhotosMutation } from "@/api/bulk-places";
import { type Place, placesQuery, readEntries } from "@/api/places";
import { BulkPlaceReview } from "@/components/bulk-places/bulk-place-review";
import { BulkPickCard } from "@/components/bulk-tagging/bulk-pick-card";
import { CopyPrompt } from "@/components/bulk-tagging/copy-prompt";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { bulkPlacePrompt, parseBulkPlaceAnswer } from "@/lib/bulk-place-prompt";
import { reviewBulkPlaces } from "@/lib/bulk-places";

/**
 * Bulk Places: picks up to the chosen number of related photos without places, copies one prompt
 * asking an LLM where each was taken, with a map link to check it by, and reads its JSON answer back
 * into a review of the place each photo gets and the new places to make.
 */
export function BulkPlacesCard() {
  return (
    <BulkPickCard
      title="Bulk places"
      description="Picks up to the chosen number of photos (up to 50) without places that go together: one, then the ones that share its city or country, genres or date. Copy one prompt for all of them into a chat with an LLM, which finds each photo's place on Google Maps (or Naver Map or Kakao Map in South Korea), paste its JSON answer back, and review the places before they're saved, waiting for Commit."
      options={pickBulkPlacePhotosMutation}
    >
      {(pick) => <PickedPlaces pick={pick} />}
    </BulkPickCard>
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
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {pick.unplaced} of {pick.photoFiles} photos have no places yet.
      </p>
      <PickedPhotos photos={pick.photos} />
      <CopyPrompt
        label={`Copy the place prompt for ${pick.photos.length} photos`}
        disabled={!places.data}
        prompt={() => bulkPlacePrompt(pick.photos, all)}
      />
      <AnswerReview pick={pick} places={all} ready={places.data !== undefined} />
    </div>
  );
}

interface AnswerReviewProps {
  pick: BulkPlacePick;
  places: Place[];
  /** Whether the places have been read, so the answer can be matched to them. */
  ready: boolean;
}

/** The box to paste the LLM's answer into, and the review it makes. */
function AnswerReview({ pick, places, ready }: AnswerReviewProps) {
  const [answer, setAnswer] = useState("");
  const [read, setRead] = useState<ReturnType<typeof readAnswer>>();
  return (
    <>
      <Textarea
        aria-label="The LLM's answer"
        placeholder="Paste the LLM's JSON answer here"
        className="min-h-32 font-mono text-xs"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <Button
        type="button"
        className="self-start"
        disabled={answer.trim() === "" || !ready}
        onClick={() => setRead(readAnswer(answer, pick, places))}
      >
        Review the places
      </Button>
      {read && <ReadAnswer read={read} />}
    </>
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
