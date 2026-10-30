import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type BulkTagPick,
  pickBulkTagPhotosMutation,
  previewBulkTagsMutation,
} from "@/api/bulk-tags";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { placesQuery, readEntries } from "@/api/places";
import { BulkPickCard, ErrorText } from "@/components/bulk-tagging/bulk-pick-card";
import { BulkTagReview } from "@/components/bulk-tagging/bulk-tag-review";
import { CopyPrompt } from "@/components/bulk-tagging/copy-prompt";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import { UntaggedCount } from "@/components/bulk-tagging/untagged-count";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { OptionCheckbox } from "@/components/update-data-shared";
import { bulkTagPrompt } from "@/lib/bulk-tag-prompt";
import { useCombinedData } from "@/stores/combined-data";

/**
 * Bulk Tagging: picks up to the chosen number of photos without tags (5 at first, up to 50), related
 * or any, copies one tag prompt for all of them, and reads the LLM's JSON answer back into a review of the tags each photo gets and the new tags to make.
 */
export function BulkTaggingCard() {
  const [related, setRelated] = useState(true);
  return (
    <BulkPickCard
      title="Bulk tagging"
      description="Picks up to the chosen number of photos (up to 50) without tags: ones that go together, or any of them. Photos that already have tags are left out. Copy one prompt for all of them into a chat with an LLM, paste its JSON answer back, and review the tags before they're saved, waiting for Commit."
      options={pickBulkTagPhotosMutation}
      body={(skip, count) => ({ skip, count, any: !related })}
      before={(pending) => (
        <>
          <UntaggedCount />
          <OptionCheckbox
            label="Pick photos that go together"
            hint="On, one photo and then the ones that share its places, city or country, genres or date. Off, the first photos without tags by file name, whatever they share."
            checked={related}
            disabled={pending}
            onChange={setRelated}
          />
        </>
      )}
    >
      {(pick) => <PickedTagging pick={pick} />}
    </BulkPickCard>
  );
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedTagging({ pick }: { pick: BulkTagPick }) {
  const [answer, setAnswer] = useState("");
  const paths = pick.photos.map((photo) => photo.path);
  const preview = useMutation(previewBulkTagsMutation);
  return (
    <div className="flex flex-col gap-4">
      <PickedPhotos photos={pick.photos} />
      <CopyPromptButton pick={pick} />
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
        disabled={answer.trim() === "" || preview.isPending}
        onClick={() => preview.mutate({ paths, answer })}
      >
        {preview.isPending && <Spinner />}
        Review the tags
      </Button>
      <ErrorText error={preview.error} />
      {preview.data && (
        <BulkTagReview key={JSON.stringify(preview.data)} preview={preview.data} pick={pick} />
      )}
    </div>
  );
}

/** Copies the prompt for every picked photo, with the tags to reuse and the names to leave out. */
function CopyPromptButton({ pick }: { pick: BulkTagPick }) {
  const organize = useQuery(organizeQuery);
  const places = useQuery(placesQuery);
  const combined = useCombinedData();
  const data = organize.data;
  const prompt = () => {
    if (!data) return null;
    const lists = { ...data, metaGroups: metaGroups(combined.data) };
    return bulkTagPrompt(pick.photos, lists, readEntries(places.data?.places));
  };
  return (
    <CopyPrompt
      label={`Copy the tag prompt for ${pick.photos.length} photos`}
      disabled={!data}
      prompt={prompt}
    />
  );
}
