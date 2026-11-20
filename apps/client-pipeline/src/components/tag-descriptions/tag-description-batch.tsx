import type { Group } from "@/api/organize";
import { CopyPromptButton } from "@/components/bulk-tagging/pick-controls";
import {
  type SaveDescriptions,
  TagDescriptionReview,
} from "@/components/tag-descriptions/tag-description-review";
import { PasteAnswer } from "@/components/paste-answer";
import { usePastedAnswer } from "@/hooks/use-pasted-answer";
import type { CombinedPhoto } from "@/lib/group-photos";
import { readTagDescriptions, tagDescriptionPrompt } from "@/lib/tag-description-prompt";
import { count } from "@portfolio/lib/words";

interface TagDescriptionBatchProps {
  /** The tags to describe this time. */
  batch: Group[];
  /** Every tag, to match the answer's names against and show described ones as examples. */
  tags: Group[];
  /** The photos ALLPHOTOS.json lists, for what each tag is used with. */
  photos: CombinedPhoto[];
  save: SaveDescriptions;
}

/** The batch's tags, their prompt, the box to paste the answer into, and its review. */
export function TagDescriptionBatch({ batch, tags, photos, save }: TagDescriptionBatchProps) {
  if (batch.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Every tag without a description was skipped. Start over to see them again.
      </p>
    );
  }
  return <BatchPrompt batch={batch} tags={tags} photos={photos} save={save} />;
}

/** The batch's tags, their prompt, and the answer box, for a batch with tags in it. */
function BatchPrompt({ batch, tags, photos, save }: TagDescriptionBatchProps) {
  const pasted = usePastedAnswer((answer) => readTagDescriptions(answer, tags));
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-1.5 text-xs">
        {batch.map((tag) => (
          <li key={tag.id} className="bg-muted rounded px-1.5 py-0.5 font-mono">
            {tag.id}
          </li>
        ))}
      </ul>
      <CopyPromptButton
        label={`Copy the description prompt for ${count(batch.length, "tag")}`}
        disabled={false}
        prompt={() => tagDescriptionPrompt(batch, tags, photos)}
      />
      <PasteAnswer pasted={pasted} label="Review the descriptions" />
      {pasted.answer && (
        <TagDescriptionReview key={pasted.reviews} read={pasted.answer} save={save} />
      )}
    </div>
  );
}
