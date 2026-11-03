import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { previewPruneTagsMutation } from "@/api/prune-tags";
import { tagLibraryQuery } from "@/api/tag-library";
import { CopyPromptButton, ErrorText, PasteAnswer } from "@/components/bulk-tagging/pick-controls";
import { PruneTagReview } from "@/components/prune-tags/prune-tag-review";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentPhotos, photoCounts } from "@/lib/group-photos";
import { pruneTagPrompt } from "@/lib/prune-tag-prompt";
import { fewPhotoTagLines } from "@/lib/tag-library-prompt";
import { useCombinedData } from "@/stores/combined-data";

/**
 * Tag pruning: copies a prompt listing every tag with its parent, description and photo count, and
 * reads the LLM's JSON answer back into a review of the tags to merge, remove and put under others.
 */
export function PruneTagsCard() {
  const [answer, setAnswer] = useState("");
  const preview = useMutation(previewPruneTagsMutation);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag pruning</CardTitle>
        <CardDescription>
          Copy a prompt with every tag, its parent, description and how many photos have it into a
          chat with an LLM, which suggests tags to merge, remove, or put under a more general one,
          keeping every tag to at least 3 photos and writing a private note on the photos of a tag
          it removes for having too few. Paste its JSON answer back and review the changes before
          they&apos;re saved, waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <PrunePromptButton />
        <PasteAnswer
          value={answer}
          onChange={setAnswer}
          pending={preview.isPending}
          label="Review the changes"
          onReview={() => preview.mutate({ answer })}
        />
        <ErrorText error={preview.error} />
        {preview.data && (
          <PruneTagReview key={JSON.stringify(preview.data)} preview={preview.data} />
        )}
      </CardContent>
    </Card>
  );
}

/** How many photos in ALLPHOTOS.json list each tag, or undefined until it's read. */
function useTagCounts(): Map<string, number> | undefined {
  const combined = useCombinedData();
  const current = combined.data ? currentPhotos(combined.data) : undefined;
  return current && photoCounts(current.photos, "tags");
}

/** The pruning prompt, or undefined until the tags, their photo counts and the photos are read. */
function usePrunePrompt(): (() => string) | undefined {
  const organize = useQuery(organizeQuery);
  const library = useQuery(tagLibraryQuery);
  const combined = useCombinedData();
  const counts = useTagCounts();
  const [data, few] = [organize.data, library.data];
  if (!data || !counts || !few) return undefined;
  return () =>
    pruneTagPrompt(
      { ...data, metaGroups: metaGroups(combined.data) },
      counts,
      fewPhotoTagLines(few),
    );
}

/**
 * Copies the prompt with every tag, the names the site already filters by, and the photos of the
 * tags with too few photos, for the notes.
 */
function PrunePromptButton() {
  const organize = useQuery(organizeQuery);
  const prompt = usePrunePrompt();
  return (
    <CopyPromptButton
      label={`Copy the pruning prompt for ${organize.data?.tags.length ?? 0} tags`}
      disabled={!prompt}
      prompt={() => prompt?.() ?? ""}
    />
  );
}
