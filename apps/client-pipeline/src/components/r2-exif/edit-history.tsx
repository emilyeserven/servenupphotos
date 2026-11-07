import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import {
  R2_EXIF_FIELD_LABELS,
  type R2ExifFieldEdit,
  type R2ExifPhoto,
  type R2ExifPreview,
  afterSave,
  r2ExifPreviewQuery,
  setR2ExifLightroomMutation,
} from "@/api/r2-exif";

/** The photo's edits of its original's EXIF, newest first, each field with its Lightroom box. */
export function EditHistory({ photo }: { photo: R2ExifPhoto }) {
  const queryClient = useQueryClient();
  const tick = useMutation({
    ...setR2ExifLightroomMutation,
    onSuccess: (result) => {
      queryClient.setQueryData<R2ExifPreview>(r2ExifPreviewQuery.queryKey, (preview) =>
        preview ? afterSave(preview, photo.path, result) : preview,
      );
    },
  });
  const edits = photo.edits.map((edit, index) => ({ edit, index })).toReversed();
  return (
    <section aria-label="Written to R2" className="flex flex-col gap-2 text-sm">
      <h3 className="text-muted-foreground text-xs font-medium">Written to R2</h3>
      {edits.map(({ edit, index }) => (
        <div key={edit.date + index} className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            {new Date(edit.date).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <ul className="flex flex-col gap-1">
            {edit.fields.map((field) => (
              <EditedField
                key={field.field}
                field={field}
                pending={tick.isPending}
                onTick={(done) =>
                  tick.mutate({ path: photo.path, edit: index, field: field.field, done })
                }
              />
            ))}
          </ul>
        </div>
      ))}
      {tick.error && <p className="text-destructive">{tick.error.message}</p>}
    </section>
  );
}

interface EditedFieldProps {
  field: R2ExifFieldEdit;
  pending: boolean;
  onTick: (done: boolean) => void;
}

/** One written field, from its old value to its new one, with "Done in Lightroom". */
function EditedField({ field, pending, onTick }: EditedFieldProps) {
  const id = useId();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className="accent-primary size-4"
          checked={field.lightroom}
          disabled={pending}
          onChange={(event) => onTick(event.target.checked)}
        />
        <label htmlFor={id}>Done in Lightroom</label>
      </span>
      <span className="min-w-0 break-all">
        <span className="font-medium">{R2_EXIF_FIELD_LABELS[field.field]}</span>:{" "}
        <span className="text-muted-foreground">{field.from ?? "None"}</span> →{" "}
        <code>{field.to}</code>
      </span>
    </li>
  );
}
