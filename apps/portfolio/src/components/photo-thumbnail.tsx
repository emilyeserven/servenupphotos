import { ImageOff } from "lucide-react";
import { useState } from "react";
import { type PhotoImage } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** The square thumbnail, or the Small version cropped square for photos saved before thumbnails. */
export function PhotoThumbnail({ image }: { image: PhotoImage }) {
  const sources = [image.thumbnail, image.small].filter((url): url is string => Boolean(url));
  const [index, setIndex] = useState(0);
  const src = sources[index];
  if (!src) return null;
  return (
    <img
      key={src}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setIndex((i) => i + 1)}
      className="size-full object-cover"
    />
  );
}

/**
 * The photo's square thumbnail as a button opening it, or an empty square for a photo without an
 * image yet. `className` sets its size.
 */
export function PhotoThumbnailButton({
  image,
  title,
  onOpen,
  className,
}: {
  image: PhotoImage | null;
  title: string;
  onOpen?: () => void;
  className?: string;
}) {
  if (!image) {
    return (
      <div
        title="No image yet"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-4" aria-hidden />
      </div>
    );
  }
  return (
    <button
      type="button"
      title="Show the whole photo"
      aria-label={`Show ${title}`}
      onClick={onOpen}
      className={cn(
        "relative block shrink-0 cursor-zoom-in overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <PhotoThumbnail image={image} />
    </button>
  );
}
