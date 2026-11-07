import type { R2ExifPhoto } from "@/api/r2-exif";
import { EditHistory } from "@/components/r2-exif/edit-history";
import { MismatchForm } from "@/components/r2-exif/mismatch-form";

/** One photo: its name and Square Thumbnail, the fields that don't match R2, and its edits. */
export function R2ExifPhotoRow({ photo }: { photo: R2ExifPhoto }) {
  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row">
      <PhotoThumbnail photo={photo} />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <PhotoName photo={photo} />
        {photo.error && (
          <p className="text-destructive text-sm">
            Couldn&apos;t read its original&apos;s EXIF: {photo.error}
          </p>
        )}
        {photo.mismatches.length > 0 && <MismatchForm photo={photo} />}
        {photo.edits.length > 0 && <EditHistory photo={photo} />}
      </div>
    </li>
  );
}

function PhotoThumbnail({ photo }: { photo: R2ExifPhoto }) {
  if (!photo.thumbnail) return <div aria-hidden className="bg-muted size-20 shrink-0 rounded-md" />;
  return (
    <img
      src={photo.thumbnail}
      alt=""
      loading="lazy"
      className="size-20 shrink-0 rounded-md object-cover"
    />
  );
}

/** The photo's title (or file name) linking to its file on GitHub, and its key in R2. */
function PhotoName({ photo }: { photo: R2ExifPhoto }) {
  const name = photo.path.split("/").pop() ?? photo.path;
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-sm">
      <a
        href={photo.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="truncate font-medium underline-offset-4 hover:underline"
      >
        {photo.title || name}
      </a>
      <code className="text-muted-foreground truncate text-xs">{photo.key}</code>
    </div>
  );
}
