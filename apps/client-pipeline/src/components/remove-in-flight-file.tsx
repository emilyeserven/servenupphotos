import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  type InFlightFile,
  type InFlightImages,
  type RemoveResult,
  bucketImagesQuery,
  removeInFlightMutation,
} from "@/api/photos";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface RemoveFileProps {
  file: InFlightFile;
  images: InFlightImages;
  onRemoved: (result: RemoveResult) => void;
}

/**
 * A Remove button that, after asking, removes the file from the pull request and its image from
 * R2. Only files the pull request adds can be removed, so others get no button.
 */
export function RemoveFile({ file, images, onRemoved }: RemoveFileProps) {
  const [confirming, setConfirming] = useState(false);
  if (file.status !== "added") return null;
  if (confirming) {
    return (
      <ConfirmRemove
        file={file}
        imageKey={images.byPath[file.path]?.key}
        onRemoved={onRemoved}
        onCancel={() => setConfirming(false)}
      />
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-destructive ml-auto self-center"
      onClick={() => setConfirming(true)}
    >
      <Trash2Icon />
      Remove
    </Button>
  );
}

interface ConfirmRemoveProps {
  file: InFlightFile;
  imageKey?: string;
  onRemoved: (result: RemoveResult) => void;
  onCancel: () => void;
}

function ConfirmRemove({ file, imageKey, onRemoved, onCancel }: ConfirmRemoveProps) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    ...removeInFlightMutation,
    onSuccess: async (result) => {
      // The page refetches the pull request itself; the image may be gone from R2 too.
      onRemoved(result);
      await queryClient.invalidateQueries({ queryKey: bucketImagesQuery.queryKey });
    },
  });

  return (
    <div className="bg-destructive/5 border-destructive/30 flex w-full flex-col gap-2 rounded-lg border p-3 font-normal">
      <p>
        Remove <span className="font-medium">{fileName(file.path)}</span> from the pull request
        <ImageClause imageKey={imageKey} />? This can't be undone here.
      </p>
      {remove.error && <p className="text-destructive">{remove.error.message}</p>}
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={remove.isPending}
          onClick={() => remove.mutate(file.path)}
        >
          {remove.isPending ? <Spinner /> : <Trash2Icon />}
          Remove
        </Button>
        <Button variant="outline" size="sm" disabled={remove.isPending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Names the R2 image that will be deleted too, when the page found one. */
function ImageClause({ imageKey }: { imageKey?: string }) {
  if (!imageKey) return null;
  return (
    <>
      {" "}
      and delete <span className="font-mono text-xs">{imageKey}</span> from R2
    </>
  );
}

/** What the last removal did, kept after its file leaves the list. */
export function RemovedNotice({
  result,
  onDismiss,
}: {
  result: RemoveResult;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="bg-muted/40 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
    >
      <CheckIcon className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <div className="flex flex-1 flex-col gap-1">
        <p>
          Removed <span className="font-medium">{fileName(result.path)}</span> from the pull
          request.
        </p>
        <ImageOutcome image={result.image} />
      </div>
      <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={onDismiss}>
        <XIcon />
      </Button>
    </div>
  );
}

/** What happened to the image in R2; nothing when R2 had no image to delete. */
function ImageOutcome({ image }: { image: RemoveResult["image"] }) {
  if (image.deleted) {
    return (
      <p className="text-muted-foreground">
        Deleted <span className="font-mono text-xs">{image.key}</span> from R2.
      </p>
    );
  }
  if (!image.message) return null;
  return <p className="text-amber-700 dark:text-amber-400">{image.message}</p>;
}

function fileName(path: string) {
  return path.split("/").pop();
}
