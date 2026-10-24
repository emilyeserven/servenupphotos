import type { ImagePhoto } from "@/lib/spotlight-zones";

/**
 * A photo as large as it fits: the full width, or the full height of the screen when that's
 * smaller, keeping its shape. Clicking it opens it in the photo viewer.
 */
export function FittedPhoto({ photo, onOpen }: { photo: ImagePhoto; onOpen: () => void }) {
  const { width, height, src, srcSet } = photo.image;
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={onOpen}
      className="mx-auto block cursor-zoom-in overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{
        aspectRatio: `${width} / ${height}`,
        width: `min(100%, calc(100svh * ${width} / ${height}))`,
      }}
    >
      <img
        src={src}
        srcSet={srcSet}
        sizes={`min(100vw, calc(100svh * ${width} / ${height}))`}
        alt=""
        loading="lazy"
        className="size-full object-cover"
      />
    </button>
  );
}
