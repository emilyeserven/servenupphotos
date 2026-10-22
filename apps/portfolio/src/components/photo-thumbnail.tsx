import { useState } from "react";
import { type PhotoImage } from "@/lib/photos";

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
