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
import { BulkTagReview } from "@/components/bulk-tagging/bulk-tag-review";
import { AnswerBox, CopyPromptButton } from "@/components/llm-answer";
import { PickedPhotos } from "@/components/bulk-tagging/picked-photos";
import { bulkTagCount, defaultBulkTagCount, PickCount } from "@/components/bulk-tagging/pick-count";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { bulkTagPrompt } from "@/lib/bulk-tag-prompt";
import { useCombinedData } from "@/stores/combined-data";

/**
 * Bulk Tagging: picks up to the chosen number of related photos (5 at first, up to 50), copies one tag prompt for all of them, and reads
 * the LLM's JSON answer back into a review of the tags each photo gets and the new tags to make.
 */
export function BulkTaggingCard() {
  const [shown, setShown] = useState<string[]>([]);
  const [count, setCount] = useState(String(defaultBulkTagCount));
  const pick = useMutation({
    ...pickBulkTagPhotosMutation,
    onSuccess: (result) => setShown((paths) => [...paths, ...result.photos.map((p) => p.path)]),
  });
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
        <div className="flex flex-wrap items-center gap-3">
          <PickCount value={count} disabled={pick.isPending} onChange={setCount} />
          <PickButtons
            picked={pick.data !== undefined}
            pending={pick.isPending}
            onPick={() => pick.mutate({ skip: shown, count: bulkTagCount(count) })}
            onRestart={() => {
              setShown([]);
              pick.mutate({ skip: [], count: bulkTagCount(count) });
            }}
          />
        </div>
        <ErrorText error={pick.error} />
        {pick.data && <PickedTagging key={pick.submittedAt} pick={pick.data} />}
      </CardContent>
    </Card>
  );
}

interface PickButtonsProps {
  /** Whether photos have been picked already, so the next pick leaves them out. */
  picked: boolean;
  pending: boolean;
  onPick: () => void;
  onRestart: () => void;
}

/** Picks photos, then other photos, or starts over from every photo. */
function PickButtons({ picked, pending, onPick, onRestart }: PickButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" disabled={pending} onClick={onPick}>
        {pending && <Spinner />}
        {picked ? "Pick other photos" : "Pick photos"}
      </Button>
      {picked && (
        <Button type="button" variant="ghost" disabled={pending} onClick={onRestart}>
          Start over
        </Button>
      )}
    </div>
  );
}

/** The picked photos, their prompt, the box to paste the answer into, and its review. */
function PickedTagging({ pick }: { pick: BulkTagPick }) {
  const paths = pick.photos.map((photo) => photo.path);
  const preview = useMutation(previewBulkTagsMutation);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {pick.untagged} of {pick.photoFiles} photos have no tags yet.
      </p>
      <PickedPhotos photos={pick.photos} />
      <BulkPromptButton pick={pick} />
      <AnswerBox
        label="Review the tags"
        pending={preview.isPending}
        error={preview.error}
        onReview={(answer) => preview.mutate({ paths, answer })}
      />
      {preview.data && (
        <BulkTagReview key={JSON.stringify(preview.data)} preview={preview.data} pick={pick} />
      )}
    </div>
  );
}

/** What went wrong, when something did. */
function ErrorText({ error }: { error: Error | null }) {
  return error && <p className="text-destructive text-sm">{error.message}</p>;
}

/** Copies the prompt for every picked photo, with the tags to reuse and the names to leave out. */
function BulkPromptButton({ pick }: { pick: BulkTagPick }) {
  const organize = useQuery(organizeQuery);
  const places = useQuery(placesQuery);
  const combined = useCombinedData();
  const data = organize.data;
  const prompt = data
    ? () =>
        bulkTagPrompt(
          pick.photos,
          { ...data, metaGroups: metaGroups(combined.data) },
          readEntries(places.data?.places),
        )
    : undefined;
  return (
    <CopyPromptButton
      label={`Copy the tag prompt for ${pick.photos.length} photos`}
      prompt={prompt}
    />
  );
}
