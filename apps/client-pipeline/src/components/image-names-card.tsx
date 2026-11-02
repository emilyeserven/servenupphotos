import { Link } from "@tanstack/react-router";
import { type ImageRename, imageNamesPreviewQuery, renameImagesMutation } from "@/api/image-names";
import { FieldChangesCard } from "@/components/field-changes-card";
import { count } from "@/components/update-data-shared";

/** The new name stem beside a renamed photo's file, shortened to fit on one line. */
function newName(file: ImageRename): string {
  const stem = file.to.replace(/^photos\/[0-9a-f]{12}-/, "").replace(/\.jpg$/, "");
  return `→ ${stem.length > 32 ? `${stem.slice(0, 31)}…` : stem}`;
}

/** Renames each titled photo's image and its resized versions in R2 after its title. */
export function ImageNamesCard() {
  return (
    <FieldChangesCard
      title="Image names"
      description={
        <>
          Names each titled photo&apos;s image in R2 after its title, so{" "}
          <code>photos/59124cb186a8-dsc0001.jpg</code> becomes{" "}
          <code>photos/59124cb186a8-amsterdam-canal.jpg</code>, along with its resized versions and
          Square Thumbnail. Camera file names repeat, so this stops new uploads from clashing with
          old ones. A name another photo already has gets “-2”, “-3” and so on. Applying copies the
          images to their new names and saves the new links in each photo file; the old images stay
          in R2, since the portfolio shows them until the pull request merges. Delete them
          afterwards from{" "}
          <Link to="/bucket" className="text-foreground underline underline-offset-4">
            Explore Bucket
          </Link>
          , where they show as not saved.
        </>
      }
      preview={imageNamesPreviewQuery}
      apply={renameImagesMutation}
      renderUnchanged={(preview) => (
        <>
          Every titled photo&apos;s image on <code>{preview.branch}</code> is already named after
          its title ({count(preview.named, "photo")}), so there&apos;s nothing to rename. Photos
          without a title ({preview.untitled}) keep their names.
        </>
      )}
      total={(preview) => count(preview.photoFiles, "photo file")}
      note={newName}
    />
  );
}
