import type { BulkTagPhoto } from "@/api/bulk-tags";
import { promptImageUrl } from "@/lib/tag-prompt";
import { tileImageUrl } from "@/lib/offline-thumbnails";
import { cn } from "@/lib/utils";

/** The photo's title, or "" when it's a draft without one. */
function title(data: Record<string, unknown>): string {
  return typeof data.title === "string" ? data.title : "";
}

/**
 * What the photo shares with the first one, or that it's the one the others were picked for. Says
 * nothing when the photos were picked whatever they share, so none share anything.
 */
function relatedText(photo: BulkTagPhoto, first: boolean, together: boolean): string {
  return first && together ? "The others go with it" : photo.related.join(", ");
}

interface PickedThumbnailProps {
  /** The photo's JSON, for its images. */
  data: Record<string, unknown>;
  alt: string;
  className?: string;
}

/** A picked photo's square thumbnail, or else its Small version. */
export function PickedThumbnail({ data, alt, className }: PickedThumbnailProps) {
  return (
    <img
      src={
        tileImageUrl(data) ?? promptImageUrl(data.images as Record<string, unknown> | undefined, "")
      }
      alt={alt}
      className={cn("bg-muted aspect-square rounded-md object-cover", className)}
    />
  );
}

/** The picked photos, each with its name and what it shares with the first. */
export function PickedPhotos({ photos }: { photos: BulkTagPhoto[] }) {
  const together = photos.some((photo) => photo.related.length > 0);
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {photos.map((photo, i) => (
        <li key={photo.path} className="flex min-w-0 flex-col gap-1 text-xs">
          <PickedThumbnail
            data={photo.data}
            alt={title(photo.data) || photo.name}
            className="w-full"
          />
          <code className="truncate" title={photo.name}>
            {photo.name}
          </code>
          {title(photo.data) && <span className="truncate">{title(photo.data)}</span>}
          <span className="text-muted-foreground">{relatedText(photo, i === 0, together)}</span>
        </li>
      ))}
    </ul>
  );
}
