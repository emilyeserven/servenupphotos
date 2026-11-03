import { HeartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { like, unlike, useIsLiked } from "@/lib/likes";
import { cn } from "@/lib/utils";

/**
 * The heart button in the photo viewer: filled red when this browser liked the photo. Pressing it
 * likes the photo or takes the like back. Likes are listed on My Likes.
 */
export function LikeButton({ id }: { id: number }) {
  const liked = useIsLiked(id);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Like"
      aria-pressed={liked}
      title={liked ? "Liked; press to unlike" : "Like (or double tap the photo)"}
      onClick={() => (liked ? unlike : like)(id)}
      className="text-white hover:bg-white/10 hover:text-white"
    >
      <HeartIcon className={cn(liked && "fill-red-500 text-red-500")} />
    </Button>
  );
}

/** A big heart that pops up over the photo and fades away, after a double tap likes it. */
export function LikeBurst({ onDone }: { onDone: () => void }) {
  return (
    <span
      aria-hidden
      onAnimationEnd={onDone}
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      <HeartIcon className="size-24 animate-like-burst fill-white/90 text-white/90 drop-shadow-lg" />
    </span>
  );
}
