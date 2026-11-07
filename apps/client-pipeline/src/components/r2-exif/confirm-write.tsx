import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import {
  R2_EXIF_FIELD_LABELS,
  type R2ExifFieldValue,
  type R2ExifPhoto,
  type R2ExifPreview,
  afterSave,
  r2ExifPreviewQuery,
  writeR2ExifMutation,
} from "@/api/r2-exif";
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
import { count } from "@/components/update-data-shared";

interface ConfirmWriteProps {
  photo: R2ExifPhoto;
  /** The picked fields and the values to write. */
  fields: R2ExifFieldValue[];
}

/**
 * "Write N fields to R2…", for the fields ticked as done in Lightroom, which asks in a modal before
 * overwriting the photo's original in R2, since that replaces the file the portfolio links to.
 */
export function ConfirmWriteButton({ photo, fields }: ConfirmWriteProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="self-start" disabled={!fields.length}>
          Write {count(fields.length, "field")} to R2…
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Overwrite the original in R2?</DialogTitle>
          <DialogDescription className="font-mono break-all">{photo.key}</DialogDescription>
        </DialogHeader>
        {open && <ConfirmWrite photo={photo} fields={fields} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmWrite({ photo, fields, onDone }: ConfirmWriteProps & { onDone: () => void }) {
  const queryClient = useQueryClient();
  const write = useMutation({
    ...writeR2ExifMutation,
    onSuccess: (result) => {
      queryClient.setQueryData<R2ExifPreview>(r2ExifPreviewQuery.queryKey, (preview) =>
        preview
          ? afterSave(
              preview,
              photo.path,
              result,
              fields.map((f) => f.field),
            )
          : preview,
      );
      onDone();
    },
  });
  return (
    <div className="flex flex-col gap-4 text-sm">
      <ul className="flex flex-col gap-1">
        {fields.map((f) => (
          <li key={f.field}>
            <span className="font-medium">{R2_EXIF_FIELD_LABELS[f.field]}</span>:{" "}
            <code className="break-all">{f.value}</code>
          </li>
        ))}
      </ul>
      <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        This replaces the JPEG in R2 that the portfolio links to, and no copy of the old one is
        kept. Check these are already changed in Lightroom: if anything goes wrong, export the photo
        again and swap it in with Replace image on the Photo page.
      </p>
      {write.error && <p className="text-destructive">{write.error.message}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={write.isPending} onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={write.isPending}
          onClick={() => write.mutate({ path: photo.path, fields })}
        >
          {write.isPending && <Spinner />}
          Overwrite in R2
        </Button>
      </DialogFooter>
    </div>
  );
}
