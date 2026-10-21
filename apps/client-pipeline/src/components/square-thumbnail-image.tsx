import { ImageOffIcon } from "lucide-react";
import { useState } from "react";
import { THUMBNAIL } from "@/api/versions";
import { ImageLightbox } from "@/components/image-lightbox";

/**
 * A photo's Square Thumbnail, small and labelled, opening at its full 500 × 500 in a lightbox. A
 * placeholder says so when it isn't in R2, as for photos uploaded before Square Thumbnails.
 */
export function SquareThumbnailImage({ name, url }: { name: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const title = `${name} · ${THUMBNAIL.label}`;
  return (
    <figure className="flex flex-col gap-1.5">
      {failed ? (
        <div className="bg-muted/40 text-muted-foreground flex size-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-2 text-center text-xs">
          <ImageOffIcon className="size-5" aria-hidden />
          No {THUMBNAIL.label} in R2
        </div>
      ) : (
        <button
          type="button"
          title={`Show the ${THUMBNAIL.label} full size`}
          onClick={() => setOpen(true)}
          className="focus-visible:ring-ring size-32 cursor-zoom-in rounded-lg outline-none focus-visible:ring-2"
        >
          <img
            src={url}
            alt={title}
            loading="lazy"
            onError={() => setFailed(true)}
            className="bg-muted size-full rounded-lg border object-cover"
          />
        </button>
      )}
      <figcaption className="text-muted-foreground text-xs">
        {THUMBNAIL.label} · {THUMBNAIL.maxEdge}×{THUMBNAIL.maxEdge}px
      </figcaption>
      <ImageLightbox
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        src={url}
        description={`The ${THUMBNAIL.label} of ${name} at full size.`}
      />
    </figure>
  );
}
