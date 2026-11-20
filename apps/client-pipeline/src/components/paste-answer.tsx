import type { ReactNode } from "react";
import { ErrorNote } from "@/components/error-note";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { PastedAnswer } from "@/hooks/use-pasted-answer";
import { canReview } from "@/lib/pasted-json";

interface PasteAnswerProps {
  /** The box's state, from `usePastedAnswer`. */
  pasted: PastedAnswer<unknown>;
  /** The review button's text, such as "Review the tags". */
  label: string;
  /** The box's placeholder, when it takes more than an LLM's JSON answer, such as a file. */
  placeholder?: string;
  /** True while what the review needs is still loading. */
  disabled?: boolean;
  /** More buttons beside the review button, such as one that loads a file into the box. */
  children?: ReactNode;
}

/**
 * The box to paste an LLM's JSON answer into, the button that reviews it, and why the last review
 * couldn't read it. Every answer box is this, with its state from `usePastedAnswer`; the review
 * goes under it, keyed by `pasted.reviews`.
 */
export function PasteAnswer({ pasted, label, placeholder, disabled, children }: PasteAnswerProps) {
  const { typed, setTyped, pending, review, error } = pasted;
  return (
    <>
      <Textarea
        aria-label="The LLM's answer"
        placeholder={placeholder ?? "Paste the LLM's JSON answer here"}
        className="min-h-32 font-mono text-xs"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!canReview(typed, pending || disabled === true)}
          onClick={review}
        >
          {pending && <Spinner />}
          {label}
        </Button>
        {children}
      </div>
      <ErrorNote error={error} />
    </>
  );
}

interface UnknownPhotosProps {
  /** The names in the answer that aren't any photo's. */
  names: string[];
  /** The photos in the answer that weren't picked, which the review shows too. */
  others?: { name: string }[];
  /** What the answer gives each photo, such as "tags". */
  noun: string;
}

/** The names as a list in quotes, such as “a”, “b”. */
function quoted(names: string[]): string {
  return names.map((name) => `“${name}”`).join(", ");
}

/**
 * Says which photos the answer names that weren't picked, which the review shows after the picked
 * ones, and which names it skipped because they aren't any photo's. Every review of a pasted
 * answer lists its leftover photo names with this.
 */
export function UnknownPhotos({ names, others = [], noun }: UnknownPhotosProps) {
  if (names.length === 0 && others.length === 0) return null;
  return (
    <div className="text-muted-foreground flex flex-col gap-1">
      <OtherPhotos names={others.map((photo) => photo.name)} noun={noun} />
      <SkippedPhotos names={names} noun={noun} />
    </div>
  );
}

/** Says the review also shows the answer's photos that weren't picked, when there are any. */
function OtherPhotos({ names, noun }: { names: string[]; noun: string }) {
  if (names.length === 0) return null;
  const were = names.length === 1 ? "wasn’t" : "weren’t";
  return (
    <p>
      Also showing the answer&apos;s {noun} for {quoted(names)}, which {were} picked.
    </p>
  );
}

/** Says which names in the answer were skipped because they aren't photos, when there are any. */
function SkippedPhotos({ names, noun }: { names: string[]; noun: string }) {
  if (names.length === 0) return null;
  const what = names.length === 1 ? "isn’t a photo" : "aren’t photos";
  return (
    <p>
      Skipped the answer&apos;s {noun} for {quoted(names)}, which {what}.
    </p>
  );
}
