import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CheckIcon, CopyIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { placesQuery, readEntries } from "@/api/places";
import type { PendingSave } from "@/api/scan-changes";
import { bulkTagCount, defaultBulkTagCount, PickCount } from "@/components/bulk-tagging/pick-count";
import {
  CommitSuccess,
  SaveButton,
  count,
  invalidatePhotoReads,
} from "@/components/update-data-shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useCombinedData } from "@/stores/combined-data";

/** What a pick of photos asks for: the photos already shown, to leave out, and how many to pick. */
interface PickRequest {
  skip: string[];
  count: number;
}

/**
 * Picks related photos with `options`, keeping the chosen count and the photos already shown, so
 * each pick after the first finds other photos until it starts over.
 */
export function usePhotoPick<T extends { photos: { path: string }[] }>(
  options: UseMutationOptions<T, Error, PickRequest>,
) {
  const [shown, setShown] = useState<string[]>([]);
  const [typed, setTyped] = useState(String(defaultBulkTagCount));
  const pick = useMutation({
    ...options,
    onSuccess: (result) => setShown((paths) => [...paths, ...result.photos.map((p) => p.path)]),
  });
  const controls: PickControlsProps = {
    count: typed,
    onCount: setTyped,
    picked: pick.data !== undefined,
    pending: pick.isPending,
    onPick: () => pick.mutate({ skip: shown, count: bulkTagCount(typed) }),
    onRestart: () => {
      setShown([]);
      pick.mutate({ skip: [], count: bulkTagCount(typed) });
    },
  };
  return { pick, controls };
}

interface PickControlsProps extends PickButtonsProps {
  /** How many photos to pick, as typed. */
  count: string;
  onCount: (count: string) => void;
}

/** How many photos to pick, and the buttons that pick them. */
export function PickControls({ count: typed, onCount, ...buttons }: PickControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <PickCount value={typed} disabled={buttons.pending} onChange={onCount} />
      <PickButtons {...buttons} />
    </div>
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

/** What went wrong, when something did. */
export function ErrorText({ error }: { error: Error | null }) {
  return error && <p className="text-destructive text-sm">{error.message}</p>;
}

interface CopyPromptButtonProps {
  /** The button's text, such as "Copy the tag prompt for 5 photos". */
  label: string;
  disabled: boolean;
  /** The prompt to copy, or null when it can't be made yet. */
  prompt: () => string | null;
}

/** Copies an LLM prompt for the picked photos, showing "Copied" for a moment once it has. */
export function CopyPromptButton({ label, disabled, prompt }: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = prompt();
    if (text === null) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      disabled={disabled}
      onClick={copy}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : label}
    </Button>
  );
}

interface AnswerBoxProps {
  answer: string;
  onChange: (answer: string) => void;
  /** The review button's text, such as "Review the tags". */
  review: string;
  pending: boolean;
  onReview: () => void;
}

/** The box to paste the LLM's JSON answer into, and the button that reviews it. */
export function AnswerBox({ answer, onChange, review, pending, onReview }: AnswerBoxProps) {
  return (
    <>
      <Textarea
        aria-label="The LLM's answer"
        placeholder="Paste the LLM's JSON answer here"
        className="min-h-32 font-mono text-xs"
        value={answer}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button
        type="button"
        className="self-start"
        disabled={answer.trim() === "" || pending}
        onClick={onReview}
      >
        {pending && <Spinner />}
        {review}
      </Button>
    </>
  );
}

/**
 * What a prompt for the picked photos lists: every album, tag and genre, the metadata groups, and
 * the places; null until the albums, tags and genres are read.
 */
export function usePromptLists() {
  const organize = useQuery(organizeQuery);
  const places = useQuery(placesQuery);
  const combined = useCombinedData();
  if (!organize.data) return null;
  return {
    lists: { ...organize.data, metaGroups: metaGroups(combined.data) },
    places: readEntries(places.data?.places),
  };
}

/** Saves what a review left ticked with `options`, then refreshes the photo reads and the albums and tags. */
export function useReviewedSave<T extends PendingSave, V>(
  options: UseMutationOptions<T, Error, V>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    onSuccess: () => {
      invalidatePhotoReads(queryClient);
      void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
    },
  });
}

interface SaveReviewedProps<T extends PendingSave, V extends { photos: unknown[] }> {
  /** What's saved for the photos, such as "tags" for "Save tags for 5 photos". */
  what: string;
  apply: UseMutationResult<T, Error, V>;
  /** What the review left to save. */
  save: V;
  busy: boolean;
  /** What was saved, once it has been, such as "Made 2 new tags and tagged 5 photos". */
  saved: (result: T) => ReactNode;
}

/** The button that saves what a review left ticked, and what it saved once it has. */
export function SaveReviewed<T extends PendingSave, V extends { photos: unknown[] }>({
  what,
  apply,
  save,
  busy,
  saved,
}: SaveReviewedProps<T, V>) {
  return (
    <>
      <SaveButton
        label={`Save ${what} for ${count(save.photos.length, "photo")}`}
        disabled={busy || save.photos.length === 0}
        pending={apply.isPending}
        error={apply.error}
        onClick={() => apply.mutate(save)}
      />
      {apply.data && <CommitSuccess result={apply.data}>{saved(apply.data)}</CommitSuccess>}
    </>
  );
}
