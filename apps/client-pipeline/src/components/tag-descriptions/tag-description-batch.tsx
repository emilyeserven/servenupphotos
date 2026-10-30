import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import type { Group } from "@/api/organize";
import {
  type SaveDescriptions,
  TagDescriptionReview,
} from "@/components/tag-descriptions/tag-description-review";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CombinedPhoto } from "@/lib/group-photos";
import {
  type TagDescriptionsRead,
  readTagDescriptions,
  tagDescriptionPrompt,
} from "@/lib/tag-description-prompt";

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
  const [answer, setAnswer] = useState("");
  const [read, setRead] = useState<TagDescriptionsRead>();
  const [error, setError] = useState("");
  const review = () => {
    try {
      setRead(readTagDescriptions(answer, tags));
      setError("");
    } catch (err) {
      setRead(undefined);
      setError((err as Error).message);
    }
  };
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
        prompt={() => tagDescriptionPrompt(batch, tags, photos)}
        size={batch.length}
      />
      <Textarea
        aria-label="The LLM's answer"
        placeholder="Paste the LLM's JSON answer here"
        className="min-h-32 font-mono text-xs"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <Button type="button" className="self-start" disabled={answer.trim() === ""} onClick={review}>
        Review the descriptions
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {read && <TagDescriptionReview key={answer} read={read} save={save} />}
    </div>
  );
}

/** Copies the prompt for the batch's tags. */
function CopyPromptButton({ prompt, size }: { prompt: () => string; size: number }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(prompt()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button type="button" variant="outline" className="self-start" onClick={copy}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied
        ? "Copied"
        : `Copy the description prompt for ${size === 1 ? "1 tag" : `${size} tags`}`}
    </Button>
  );
}
