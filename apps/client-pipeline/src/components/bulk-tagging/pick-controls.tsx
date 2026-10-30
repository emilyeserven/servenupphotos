import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { PickCount, bulkTagCount } from "@/components/bulk-tagging/pick-count";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

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

/** What a pick asks for: the photos already shown, to leave out, and how many to pick. */
interface PickRequest {
  skip: string[];
  count: number;
}

/**
 * A pick of photos that can pick other photos, leaving out the ones already shown, or start over,
 * with `bar`, the props of the PickBar that does so. The count starts at `fallback`, and `extra`
 * goes with each pick, such as Bulk Tagging's `any`.
 */
export function usePhotoPick<
  TData extends { photos: { path: string }[] },
  TExtra extends object = Record<never, never>,
>(
  options: UseMutationOptions<TData, Error, PickRequest & TExtra>,
  fallback: number,
  extra = {} as TExtra,
) {
  const [shown, setShown] = useState<string[]>([]);
  const [count, setCount] = useState(String(fallback));
  const pick = useMutation({
    ...options,
    onSuccess: (result) => setShown((paths) => [...paths, ...result.photos.map((p) => p.path)]),
  });
  const bar: PickBarProps = {
    count,
    fallback,
    setCount,
    pending: pick.isPending,
    picked: pick.data !== undefined,
    onPick: () => pick.mutate({ ...extra, skip: shown, count: bulkTagCount(count, fallback) }),
    onRestart: () => {
      setShown([]);
      pick.mutate({ ...extra, skip: [], count: bulkTagCount(count, fallback) });
    },
  };
  return { pick, bar };
}

type PickBarProps = PickButtonsProps & {
  count: string;
  fallback: number;
  setCount: (value: string) => void;
};

/** How many photos to pick, and the buttons that pick them. */
export function PickBar({ count, fallback, setCount, ...buttons }: PickBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <PickCount value={count} fallback={fallback} disabled={buttons.pending} onChange={setCount} />
      <PickButtons {...buttons} />
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
  prompt: () => string;
}

/** Copies the prompt for the picked photos, showing "Copied" for a moment once it has. */
export function CopyPromptButton({ label, disabled, prompt }: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(prompt()).then(() => {
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

interface PasteAnswerProps {
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  /** The review button's text, such as "Review the tags". */
  label: string;
  onReview: () => void;
}

/** The box to paste the LLM's JSON answer into, and the button that reviews it. */
export function PasteAnswer({ value, onChange, pending, label, onReview }: PasteAnswerProps) {
  return (
    <>
      <Textarea
        aria-label="The LLM's answer"
        placeholder="Paste the LLM's JSON answer here"
        className="min-h-32 font-mono text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button
        type="button"
        className="self-start"
        disabled={value.trim() === "" || pending}
        onClick={onReview}
      >
        {pending && <Spinner />}
        {label}
      </Button>
    </>
  );
}
