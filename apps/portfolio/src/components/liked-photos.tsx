import { format } from "date-fns";
import { HeartIcon } from "lucide-react";
import { useState } from "react";
import { PhotoThumbnailButton } from "@/components/photo-thumbnail";
import type { ImagePhoto } from "@/components/photo-tiles";
import { Button } from "@/components/ui/button";
import { setLikeComment, unlike, useLikeComments } from "@/lib/likes";

/** My Likes' photos, one row each, with the visitor's own comment on it. */
export function LikedPhotos({
  photos,
  onOpen,
}: {
  photos: readonly ImagePhoto[];
  onOpen: (photo: ImagePhoto) => void;
}) {
  const comments = useLikeComments();
  return (
    <ul className="flex flex-col divide-y">
      {photos.map((photo) => (
        <LikedPhotoRow
          key={photo.id}
          photo={photo}
          comment={comments[photo.id] ?? ""}
          onOpen={() => onOpen(photo)}
        />
      ))}
    </ul>
  );
}

/**
 * One liked photo: its thumbnail, which opens it, its title and date, a box for the visitor's own
 * comment, saved in this browser as they type, and a heart to unlike it.
 */
function LikedPhotoRow({
  photo,
  comment,
  onOpen,
}: {
  photo: ImagePhoto;
  comment: string;
  onOpen: () => void;
}) {
  // Kept here while typing, so a cursor in the middle of the comment doesn't jump to its end.
  const [draft, setDraft] = useState(comment);
  const commentId = `like-comment-${photo.id}`;
  return (
    <li className="flex gap-3 py-3 sm:gap-4">
      <PhotoThumbnailButton
        image={photo.image}
        title={photo.title}
        onOpen={onOpen}
        className="size-20 sm:size-28"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{photo.title}</p>
            <p className="text-xs text-muted-foreground">{format(photo.takenAt, "MMM d, yyyy")}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Unlike ${photo.title}`}
            title="Unlike"
            onClick={() => unlike(photo.id)}
            className="-mt-1 -mr-1 shrink-0"
          >
            <HeartIcon className="fill-red-500 text-red-500" />
          </Button>
        </div>
        <label htmlFor={commentId} className="sr-only">
          My comment on {photo.title}
        </label>
        <textarea
          id={commentId}
          value={draft}
          placeholder="Add a comment…"
          rows={2}
          onChange={(event) => {
            setDraft(event.target.value);
            setLikeComment(photo.id, event.target.value);
          }}
          className="w-full resize-y rounded-md border bg-background px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
    </li>
  );
}
