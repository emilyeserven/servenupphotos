import { Link } from "@tanstack/react-router";
import { reapplyMutation, reapplyPreviewQuery } from "@/api/cameras";
import { FieldChangesCard } from "@/components/field-changes-card";
import { count } from "@/components/update-data-shared";

/** Applies the camera overrides again to every photo file, after they've changed. */
export function ReapplyOverridesCard() {
  return (
    <FieldChangesCard
      title="Camera overrides"
      description={
        <>
          Applies the{" "}
          <Link to="/camera-overrides" className="text-foreground underline underline-offset-4">
            camera overrides
          </Link>{" "}
          to every photo file again, starting from each photo&apos;s EXIF values: its own, or the
          ones its <code>exifOriginals</code> kept when an override changed them. A field no
          override sets any more goes back to its EXIF value. New photos get the overrides when
          their EXIF is read.
        </>
      }
      preview={reapplyPreviewQuery}
      apply={reapplyMutation}
      renderUnchanged={(preview) => (
        <>
          All {count(preview.photoFiles, "photo file")} on <code>{preview.branch}</code> already
          have the {count(preview.overrides, "camera override")}, so there&apos;s nothing to change.
        </>
      )}
      total={(preview) => count(preview.photoFiles, "photo file")}
      note={(file) => `${file.camera}, ${count(file.changes.length, "field")}`}
    />
  );
}
