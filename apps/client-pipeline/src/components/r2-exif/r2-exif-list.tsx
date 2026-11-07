import { useState } from "react";
import { type R2ExifPhoto, type R2ExifPreview, lightroomToDo } from "@/api/r2-exif";
import { R2ExifPhotoRow } from "@/components/r2-exif/r2-exif-photo";
import { Button } from "@/components/ui/button";
import { Unreadable, count } from "@/components/update-data-shared";

/** Which photos the list shows. */
type Show = "all" | "mismatch" | "lightroom";

/** Each filter's button label and the photos it keeps. */
const FILTERS: { show: Show; label: string; keep: (p: R2ExifPhoto) => boolean }[] = [
  { show: "all", label: "All", keep: () => true },
  { show: "mismatch", label: "Doesn't match R2", keep: needsWrite },
  { show: "lightroom", label: "To do in Lightroom", keep: (p) => lightroomToDo(p) > 0 },
];

/** Whether the photo's original has fields that don't match, or couldn't be read. */
function needsWrite(photo: R2ExifPhoto): boolean {
  return photo.mismatches.length > 0 || Boolean(photo.error);
}

/** The photos the check found, with how many need what, and a filter. */
export function R2ExifList({ preview }: { preview: R2ExifPreview }) {
  const [show, setShow] = useState<Show>("all");
  const keep = FILTERS.find((f) => f.show === show)?.keep ?? needsWrite;
  const photos = preview.photos.filter(keep);
  return (
    <div className="flex flex-col gap-4">
      <Summary preview={preview} />
      <Unreadable files={preview.unreadable} />
      {preview.photos.length > 0 && (
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.show}
              type="button"
              size="sm"
              variant={f.show === show ? "secondary" : "ghost"}
              aria-pressed={f.show === show}
              onClick={() => setShow(f.show)}
            >
              {f.label} ({preview.photos.filter(f.keep).length})
            </Button>
          ))}
        </div>
      )}
      <ul className="flex flex-col divide-y rounded-md border">
        {photos.map((photo) => (
          <R2ExifPhotoRow key={photo.path} photo={photo} />
        ))}
      </ul>
    </div>
  );
}

/** How many originals were read, how many don't match and how many changes Lightroom still needs. */
function Summary({ preview }: { preview: R2ExifPreview }) {
  const mismatched = preview.photos.filter(needsWrite).length;
  const toDo = preview.photos.reduce((n, p) => n + lightroomToDo(p), 0);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        Read {count(preview.checked, "original")} of {count(preview.photoFiles, "photo file")} on{" "}
        <code>{preview.branch}</code>: <strong>{count(mismatched, "photo")}</strong>{" "}
        {mismatched === 1 ? "doesn't" : "don't"} match R2.
      </p>
      <p className="text-muted-foreground">
        {toDo === 0
          ? "Every change written to R2 is ticked as made in Lightroom."
          : `${count(toDo, "written change")} still to make in Lightroom.`}
      </p>
    </div>
  );
}
