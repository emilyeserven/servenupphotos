import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TriangleAlertIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import {
  type BucketImage,
  type DeleteBucketImagesResult,
  bucketImagesQuery,
  deleteBucketImagesMutation,
} from "@/api/photos";
import type { PhotoState } from "@/components/bucket-filters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface DeleteImageProps {
  image: BucketImage;
  /** For an original: its resized copies, which are deleted with it unless unticked. */
  copies: BucketImage[];
  /** Where the photo's data is, or undefined when that couldn't be checked. */
  state?: PhotoState;
  /** The open pull request's number, for the in-flight warning. */
  pullRequest?: number;
}

/**
 * A Delete button that, after asking in a modal, deletes the image (and an original's resized
 * copies) from R2. It warns first when photo data still points at the image.
 */
export function DeleteImageButton(props: DeleteImageProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive self-start"
        >
          <Trash2Icon />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete from R2?</DialogTitle>
          <DialogDescription className="font-mono break-all">{props.image.key}</DialogDescription>
        </DialogHeader>
        {open && <ConfirmDelete {...props} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDelete({
  image,
  copies,
  state,
  pullRequest,
  onDone,
}: DeleteImageProps & { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [withCopies, setWithCopies] = useState(true);
  const remove = useMutation({
    ...deleteBucketImagesMutation,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: bucketImagesQuery.queryKey });
      if (result.failed.length === 0) onDone();
    },
  });
  const keys = keysToDelete(image, copies, withCopies);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        This deletes {imageCount(keys.length)} from the bucket for good. Nothing else changes: photo
        data that points at it is left as it is.
      </p>
      <UsageWarning state={state} pullRequest={pullRequest} />
      <CopiesCheckbox count={copies.length} checked={withCopies} onChange={setWithCopies} />
      <DeleteOutcome error={remove.error} result={remove.data} />
      <DialogFooter>
        <Button variant="outline" disabled={remove.isPending} onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={remove.isPending}
          onClick={() => remove.mutate(keys)}
        >
          {remove.isPending ? <Spinner /> : <Trash2Icon />}
          {state === "unsaved" ? "Delete" : "Delete anyway"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** The image's key, then its copies' keys when they're deleted with it. */
function keysToDelete(image: BucketImage, copies: BucketImage[], withCopies: boolean): string[] {
  return withCopies ? [image.key, ...copies.map((copy) => copy.key)] : [image.key];
}

function imageCount(count: number): string {
  return count === 1 ? "the image" : `${count} images`;
}

/** What each photo data state means for deleting its image. */
const WARNINGS: Record<"in-flight" | "saved" | "unknown", (pullRequest?: number) => string> = {
  "in-flight": (pullRequest) =>
    `This photo's data is in the open Add photo data pull request${pullRequest ? ` (#${pullRequest})` : ""} and points at this image, so it would show as a broken image once merged. Removing the photo in Photos in Flight takes out its data and deletes its images together.`,
  saved: () =>
    "This photo is in ALLPHOTOS.json, so the portfolio shows it from this image. Deleting it leaves a broken image on the portfolio.",
  unknown: () =>
    "Couldn't check whether any photo data uses this image, so it may be in the portfolio or in flight.",
};

/** A warning when photo data uses the image, or might; nothing for an image saved nowhere. */
function UsageWarning({ state, pullRequest }: { state?: PhotoState; pullRequest?: number }) {
  if (state === "unsaved") return null;
  return (
    <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {WARNINGS[state ?? "unknown"](pullRequest)}
    </p>
  );
}

/** "Also delete its N resized copies", for an original that has any. */
function CopiesCheckbox({
  count,
  checked,
  onChange,
}: {
  count: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className="accent-primary size-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>
        Also delete its {count === 1 ? "resized copy" : `${count} resized copies`}
      </label>
    </div>
  );
}

/** Why the delete failed, or which images couldn't be deleted. */
function DeleteOutcome({
  error,
  result,
}: {
  error: Error | null;
  result?: DeleteBucketImagesResult;
}) {
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!result?.failed.length) return null;
  return (
    <ul className="text-destructive flex flex-col gap-1">
      {result.failed.map((failed) => (
        <li key={failed.key}>
          <span className="font-mono text-xs break-all">{failed.key}</span>: {failed.message}
        </li>
      ))}
    </ul>
  );
}
