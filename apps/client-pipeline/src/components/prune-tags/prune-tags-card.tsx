import { useMutation, useQuery } from "@tanstack/react-query";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { previewPruneTagsMutation } from "@/api/prune-tags";
import { AnswerBox, CopyPromptButton } from "@/components/llm-answer";
import { PruneTagReview } from "@/components/prune-tags/prune-tag-review";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentPhotos, photoCounts } from "@/lib/group-photos";
import { pruneTagPrompt } from "@/lib/prune-tag-prompt";
import { useCombinedData } from "@/stores/combined-data";

/**
 * Tag pruning: copies a prompt listing every tag with its parent, description and photo count, and
 * reads the LLM's JSON answer back into a review of the tags to merge, remove and put under others.
 */
export function PruneTagsCard() {
  const preview = useMutation(previewPruneTagsMutation);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag pruning</CardTitle>
        <CardDescription>
          Copy a prompt with every tag, its parent, description and how many photos have it into a
          chat with an LLM, which suggests tags to merge, remove, or put under a more general one.
          Paste its JSON answer back and review the changes before they&apos;re saved, waiting for
          Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <PrunePromptButton />
        <AnswerBox
          label="Review the changes"
          pending={preview.isPending}
          error={preview.error}
          onReview={(answer) => preview.mutate({ answer })}
        />
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

/** Copies the prompt with every tag, and the names the site already filters by. */
function PrunePromptButton() {
  const organize = useQuery(organizeQuery);
  const combined = useCombinedData();
  const counts = useTagCounts();
  const data = organize.data;
  const prompt =
    data && counts
      ? () => pruneTagPrompt({ ...data, metaGroups: metaGroups(combined.data) }, counts)
      : undefined;
  return (
    <CopyPromptButton
      label={`Copy the pruning prompt for ${data?.tags.length ?? 0} tags`}
      prompt={prompt}
    />
  );
}
