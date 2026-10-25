import type { BulkTagPhoto } from "@/api/bulk-tags";
import { promptImageUrl } from "@/lib/tag-prompt";

/** The photo's title, or "" when it's a draft without one. */
function title(data: Record<string, unknown>): string {
  return typeof data.title === "string" ? data.title : "";
}

/** The tags the photo has now, as its JSON lists them. */
function tagCount(data: Record<string, unknown>): number {
  return Array.isArray(data.tags) ? data.tags.length : 0;
}

/** What the photo shares with the first one, or that it's the one the others were picked for. */
function relatedText(photo: BulkTagPhoto, first: boolean): string {
  return first ? "Fewest tags; the others go with it" : photo.related.join(", ");
}

/** The picked photos, each with its name, how many tags it has and what it shares with the first. */
export function PickedPhotos({ photos }: { photos: BulkTagPhoto[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {photos.map((photo, i) => (
        <li key={photo.path} className="flex min-w-0 flex-col gap-1 text-xs">
          <img
            src={promptImageUrl(photo.data.images as Record<string, unknown> | undefined, "")}
            alt={title(photo.data) || photo.name}
            className="bg-muted aspect-square w-full rounded-md object-cover"
          />
          <code className="truncate" title={photo.name}>
            {photo.name}
          </code>
          {title(photo.data) && <span className="truncate">{title(photo.data)}</span>}
          <span className="text-muted-foreground">
            {tagCount(photo.data) === 1 ? "1 tag" : `${tagCount(photo.data)} tags`} ·{" "}
            {relatedText(photo, i === 0)}
          </span>
        </li>
      ))}
    </ul>
  );
}
