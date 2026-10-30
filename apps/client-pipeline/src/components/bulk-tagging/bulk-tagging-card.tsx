import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  type BulkTagPick,
  pickBulkTagPhotosMutation,
  previewBulkTagsMutation,
} from "@/api/bulk-tags";
import { BulkTagReview } from "@/components/bulk-tagging/bulk-tag-review";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import {
  AnswerBox,
  CopyPromptButton,
  ErrorText,
  PickControls,
  usePhotoPick,
  usePromptLists,
} from "@/components/bulk-tagging/prompt-steps";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { bulkTagPrompt } from "@/lib/bulk-tag-prompt";

/**
 * Bulk Tagging: picks up to the chosen number of related photos (5 at first, up to 50), copies one tag prompt for all of them, and reads
 * the LLM's JSON answer back into a review of the tags each photo gets and the new tags to make.
 */
export function BulkTaggingCard() {
  const { pick, controls } = usePhotoPick(pickBulkTagPhotosMutation);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk tagging</CardTitle>
        <CardDescription>
          Picks up to the chosen number of photos (up to 50) without tags that go together: one,
          then the ones that share its places, city or country, genres or date. Photos that already
          have tags are left out. Copy one prompt for all of them into a chat with an LLM, paste its
          JSON answer back, and review the tags before they&apos;re saved, waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PickControls {...controls} />
        <ErrorText error={pick.error} />
        {pick.data && <PickedTagging key={pick.submittedAt} pick={pick.data} />}
      </CardContent>
    </Card>
  );
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedTagging({ pick }: { pick: BulkTagPick }) {
  const [answer, setAnswer] = useState("");
  const paths = pick.photos.map((photo) => photo.path);
  const preview = useMutation(previewBulkTagsMutation);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {pick.untagged} of {pick.photoFiles} photos have no tags yet.
      </p>
      <PickedPhotos photos={pick.photos} />
      <CopyTagPromptButton pick={pick} />
      <AnswerBox
        answer={answer}
        onChange={setAnswer}
        review="Review the tags"
        pending={preview.isPending}
        onReview={() => preview.mutate({ paths, answer })}
      />
      <ErrorText error={preview.error} />
      {preview.data && (
        <BulkTagReview key={JSON.stringify(preview.data)} preview={preview.data} pick={pick} />
      )}
    </div>
  );
}

/** Copies the prompt for every picked photo, with the tags to reuse and the names to leave out. */
function CopyTagPromptButton({ pick }: { pick: BulkTagPick }) {
  const known = usePromptLists();
  const prompt = () => known && bulkTagPrompt(pick.photos, known.lists, known.places);
  return (
    <CopyPromptButton
      label={`Copy the tag prompt for ${pick.photos.length} photos`}
      disabled={!known}
      prompt={prompt}
    />
  );
}
