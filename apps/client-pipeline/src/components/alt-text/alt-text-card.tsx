import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type AltTextPick,
  pickAltTextPhotosMutation,
  previewAltTextMutation,
} from "@/api/alt-text";
import { placesQuery, readEntries } from "@/api/places";
import { AltTextReview } from "@/components/alt-text/alt-text-review";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import {
  CopyPromptButton,
  ErrorText,
  PasteAnswer,
  PickBar,
  usePhotoPick,
} from "@/components/bulk-tagging/pick-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { altTextPrompt } from "@/lib/alt-text-prompt";

/** How many photos the Alt Text page picks until another number is chosen. */
const defaultAltTextCount = 20;

/**
 * Alt Text: picks up to 50 photos without alt text, copies one prompt asking an LLM to describe
 * each, and reads its JSON answer back into a review where each description can be edited or
 * left out before it's saved.
 */
export function AltTextCard() {
  const { pick, bar } = usePhotoPick(pickAltTextPhotosMutation, defaultAltTextCount);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Write alt text</CardTitle>
        <CardDescription>
          Picks a batch of up to 50 photos without alt text, in file name order. Copy one prompt for
          all of them into a chat with an LLM that can see images, which describes each photo for
          screen readers, paste its JSON answer back, and edit the descriptions before they&apos;re
          saved, waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PickBar {...bar} />
        <ErrorText error={pick.error} />
        {pick.data && <PickedAltText key={pick.submittedAt} pick={pick.data} />}
      </CardContent>
    </Card>
  );
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedAltText({ pick }: { pick: AltTextPick }) {
  const [answer, setAnswer] = useState("");
  const places = useQuery(placesQuery);
  const preview = useMutation(previewAltTextMutation);
  const paths = pick.photos.map((photo) => photo.path);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {pick.withoutAltText} of {pick.photoFiles} photos have no alt text yet.
      </p>
      <PickedPhotos photos={pick.photos} />
      <CopyPromptButton
        label={`Copy the alt text prompt for ${pick.photos.length} photos`}
        disabled={false}
        prompt={() => altTextPrompt(pick.photos, readEntries(places.data?.places))}
      />
      <PasteAnswer
        value={answer}
        onChange={setAnswer}
        pending={preview.isPending}
        label="Review the alt text"
        onReview={() => preview.mutate({ paths, answer })}
      />
      <ErrorText error={preview.error} />
      {preview.data && (
        <AltTextReview key={JSON.stringify(preview.data)} preview={preview.data} pick={pick} />
      )}
    </div>
  );
}
