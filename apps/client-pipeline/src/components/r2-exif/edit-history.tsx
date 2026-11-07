import { R2_EXIF_FIELD_LABELS, type R2ExifPhoto } from "@/api/r2-exif";

/** The photo's earlier writes to its original's EXIF in R2, newest first. */
export function EditHistory({ photo }: { photo: R2ExifPhoto }) {
  return (
    <section aria-label="Written to R2" className="flex flex-col gap-2 text-sm">
      <h3 className="text-muted-foreground text-xs font-medium">Written to R2</h3>
      {photo.edits.toReversed().map((edit) => (
        <div key={edit.date} className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            {new Date(edit.date).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <ul className="flex flex-col gap-1">
            {edit.fields.map((field) => (
              <li key={field.field} className="min-w-0 break-all">
                <span className="font-medium">{R2_EXIF_FIELD_LABELS[field.field]}</span>:{" "}
                <span className="text-muted-foreground">{field.from ?? "None"}</span> →{" "}
                <code>{field.to}</code>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
