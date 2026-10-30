import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type Group, organizeQuery } from "@/api/organize";
import type { CombinedData } from "@/api/photos";
import { bulkTagCount, PickCount } from "@/components/bulk-tagging/pick-count";
import { TagDescriptionBatch } from "@/components/tag-descriptions/tag-description-batch";
import {
  type SaveDescriptions,
  useSaveDescriptions,
} from "@/components/tag-descriptions/tag-description-review";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CommitSuccess, count } from "@/components/update-data-shared";
import { currentPhotos } from "@/lib/group-photos";
import { tagsToDescribe } from "@/lib/tag-description-prompt";
import { useCombinedData } from "@/stores/combined-data";

/** How many tags a batch has until another number is chosen. */
const defaultBatchSize = 25;

/**
 * Tag descriptions: takes a batch of the tags without a description (25 at first, up to 50),
 * copies one prompt asking an LLM to describe them, and reads its JSON answer back into a review of
 * the descriptions before they're saved, waiting for Commit.
 */
export function TagDescriptionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag descriptions</CardTitle>
        <CardDescription>
          Takes a batch of the tags without a description, up to 50 at a time. Copy one prompt for
          all of them into a chat with an LLM, with what their photos say about each, paste its JSON
          answer back, and review the descriptions before they&apos;re saved, waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <TagDescriptionsBody />
      </CardContent>
    </Card>
  );
}

/** How many tags have no description, the batch to describe, and what the last save did. */
function TagDescriptionsBody() {
  const organize = useQuery(organizeQuery);
  const save = useSaveDescriptions();
  const tags = organize.data?.tags ?? [];
  return (
    <>
      <TagCounts loading={organize.isPending} error={organize.error} tags={tags} />
      <BatchPicker tags={tags} save={save} />
      {save.data && (
        <CommitSuccess result={save.data}>Described {count(save.data.files, "tag")}</CommitSuccess>
      )}
    </>
  );
}

interface TagCountsProps {
  loading: boolean;
  error: Error | null;
  tags: Group[];
}

/** How many of the tags have no description, or why the tags can't be read. */
function TagCounts({ loading, error, tags }: TagCountsProps) {
  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (loading) return <p className="text-muted-foreground text-sm">Reading the tags…</p>;
  const missing = tagsToDescribe(tags, new Set()).length;
  return (
    <p className="text-muted-foreground text-sm">
      {missing === 0
        ? `All ${count(tags.length, "tag")} have a description.`
        : `${missing} of ${count(tags.length, "tag")} have no description yet.`}
    </p>
  );
}

/** The photos ALLPHOTOS.json lists, with the changes waiting for Commit; none until it's read. */
function combinedPhotos(data: CombinedData | undefined) {
  return data ? (currentPhotos(data)?.photos ?? []) : [];
}

/**
 * The batch size and skip buttons, then the batch: the first tags without a description, by ID,
 * leaving out the skipped ones. Hidden when every tag has a description.
 */
function BatchPicker({ tags, save }: { tags: Group[]; save: SaveDescriptions }) {
  const combined = useCombinedData();
  const [size, setSize] = useState(String(defaultBatchSize));
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const remaining = tagsToDescribe(tags, skipped);
  const batch = remaining.slice(0, bulkTagCount(size, defaultBatchSize));
  if (tagsToDescribe(tags, new Set()).length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <PickCount
          label="Tags per batch"
          fallback={defaultBatchSize}
          value={size}
          disabled={save.isPending}
          onChange={setSize}
        />
        <SkipButtons
          size={batch.length}
          skipped={skipped.size}
          onSkip={() => setSkipped(new Set([...skipped, ...batch.map((tag) => tag.id)]))}
          onRestart={() => setSkipped(new Set())}
        />
      </div>
      <TagDescriptionBatch
        key={batch.map((tag) => tag.id).join(",")}
        batch={batch}
        tags={tags}
        photos={combinedPhotos(combined.data)}
        save={save}
      />
    </>
  );
}

interface SkipButtonsProps {
  /** How many tags the batch has. */
  size: number;
  /** How many tags were skipped so far. */
  skipped: number;
  onSkip: () => void;
  onRestart: () => void;
}

/** Skips the batch's tags for the next ones, or brings back every skipped tag. */
function SkipButtons({ size, skipped, onSkip, onRestart }: SkipButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" disabled={size === 0} onClick={onSkip}>
        {size === 1 ? "Skip this tag" : `Skip these ${size}`}
      </Button>
      {skipped > 0 && (
        <Button type="button" variant="ghost" onClick={onRestart}>
          Start over
        </Button>
      )}
    </div>
  );
}
