import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type BulkPlacePick,
  findPhotosByNameMutation,
  pickBulkPlacePhotosMutation,
} from "@/api/bulk-places";
import type { BulkTagPhoto } from "@/api/bulk-tags";
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
import { ContactSheetsButton, usePickedContactSheets } from "@/components/contact-sheets-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bulkPlacePrompt, parseBulkPlaceAnswer } from "@/lib/bulk-place-prompt";
import { noPlacePaths, reviewBulkPlaces, unpickedNames } from "@/lib/bulk-places";
import { NoPlaceFoundNote } from "@/components/bulk-places/no-place-found";
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
        <ErrorText error={pick.error} />
        {pick.data && <PickedPlaces key={pick.submittedAt} pick={pick.data} />}
      </CardContent>
    </Card>
  );
}

/** The pasted answer's photos, read, and the names it gives that aren't any of the picked photos. */
function pastedAnswer(answer: string, pick: BulkPlacePick) {
  const pasted = parseBulkPlaceAnswer(answer);
  return { pasted, unpicked: pasted ? unpickedNames(pick.photos, pasted) : [] };
}

/**
 * The review the pasted answer makes for the picked photos and `others`, the ones it names that
 * weren't picked, or null when it has no list of photos.
 */
function readAnswer(answer: string, pick: BulkPlacePick, places: Place[], others: BulkTagPhoto[]) {
  const { pasted } = pastedAnswer(answer, pick);
  return { review: pasted && reviewBulkPlaces(pick.photos, pasted, places, others) };
}

/**
 * Reads the pasted answer into its review, first finding the photos it names that weren't picked
 * among every photo, so an answer for another batch still applies to the photos it names.
 */
function useReadAnswer(pick: BulkPlacePick, places: Place[]) {
  const find = useMutation(findPhotosByNameMutation);
  const [read, setRead] = useState<ReturnType<typeof readAnswer>>();
  const remember = useNoPlaceFoundStore((state) => state.add);
  const done = (answer: string, others: BulkTagPhoto[]) => {
    const next = readAnswer(answer, pick, places, others);
    if (next.review) remember(noPlacePaths(next.review));
    setRead(next);
  };
  const review = (answer: string) => {
    const { unpicked } = pastedAnswer(answer, pick);
    if (unpicked.length === 0) return done(answer, []);
    find.mutate(unpicked, { onSuccess: (found) => done(answer, found.photos) });
  };
  return { read, review, find };
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
  const [answer, setAnswer] = useState("");
  const { read, review, find } = useReadAnswer(pick, places);
  return (
    <>
      <PasteAnswer
        value={answer}
        onChange={setAnswer}
        pending={loading || find.isPending}
        label="Review the places"
        onReview={() => review(answer)}
      />
      <ErrorText error={find.error} />
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
