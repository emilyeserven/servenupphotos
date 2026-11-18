import { ImageOffIcon } from "lucide-react";
import { useState } from "react";
import { type GalleryFile, fullImageUrl } from "@/components/gallery/gallery-files";
import { KindBadge } from "@/components/gallery/kind-mark";
import { squareImages } from "@/lib/offline-thumbnails";
import { cn } from "@/lib/utils";

/**
 * The photo's Square Thumbnail, over its blurred Thumbnail Preview, with its Draft, Undecided or
 * Lower Tier mark, opening the photo in the Gallery's viewer.
 */
export function SquareTile({
  file,
  name,
  onSelect,
  onOpen,
}: {
  file: GalleryFile;
  name: string;
  /** Called instead of opening the photo, while photos are being chosen. */
  onSelect?: () => void;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const urls = tileUrls(file);
  if (!urls || failed) return <MissingTile />;
  const { className, ...button } = tileButton(onSelect, onOpen);
  return (
    <button
      type="button"
      {...button}
      data-lightbox-photo={file.path}
      className={cn(
        "focus-visible:ring-ring bg-muted relative aspect-square w-full overflow-hidden border-b outline-none focus-visible:ring-2 focus-visible:ring-inset",
        className,
      )}
    >
      <PreviewImage src={urls.preview} />
      <img
        src={urls.square}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("relative size-full object-cover", file.kind !== "published" && "opacity-75")}
      />
      <KindBadge kind={file.kind} />
    </button>
  );
}

/** What the tile does when clicked: chooses the photo while choosing them, or else opens it. */
function tileButton(onSelect: (() => void) | undefined, onOpen: () => void) {
  if (!onSelect)
    return {
      title: "Show it full size; the arrow keys then move between the photos",
      onClick: onOpen,
      className: "cursor-zoom-in",
    };
  // The checkbox over the corner is the control keyboards and screen readers use while choosing.
  return {
    title: "Choose or unchoose it",
    onClick: onSelect,
    tabIndex: -1,
    className: "cursor-pointer",
  };
}

function MissingTile() {
  return (
    <div className="bg-muted/40 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-1 border-b text-xs">
      <ImageOffIcon className="size-6" aria-hidden />
      No image
    </div>
  );
}

/**
 * The tile's Square Thumbnail and Thumbnail Preview from the offline copy, as saved in the photo's
 * JSON or else next to its image in R2, and the image itself; undefined without an image in R2.
 */
function tileUrls(file: GalleryFile) {
  if (!file.r2Url || !fullImageUrl(file)) return undefined;
  return squareImages(file.edited, file.r2Url);
}

/** The blurred Thumbnail Preview behind the Square Thumbnail; nothing for a photo without one. */
function PreviewImage({ src }: { src?: string }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      // Photos uploaded before Thumbnail Previews don't have one, so it hides itself.
      onError={(e) => (e.currentTarget.hidden = true)}
      className="absolute inset-0 size-full scale-110 object-cover blur-md"
    />
  );
}
