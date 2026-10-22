import { format } from "date-fns";
import { XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, useState } from "react";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLocation } from "@/components/photo-location";
import { Button } from "@/components/ui/button";
import { settingsText, type Photo, type PhotoImage } from "@/lib/photos";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  /** The photo to show, or null when the lightbox is closed. */
  photo: (Photo & { image: PhotoImage }) | null;
  onClose: () => void;
}

// A quick fade in on opening and out on closing, for both the overlay and the content.
const FADE =
  "duration-250 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

/** A full-window overlay showing a whole photo, as large as fits the window. */
export function PhotoLightbox({ photo: openPhoto, onClose }: PhotoLightboxProps) {
  // The last photo shown, kept while the lightbox fades out after photo goes back to null.
  const [photo, setPhoto] = useState(openPhoto);
  if (openPhoto && openPhoto !== photo) setPhoto(openPhoto);
  // The tile that opened it, to focus again on closing, as there's no Dialog.Trigger to go back to.
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={openPhoto !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn("fixed inset-0 z-50 bg-neutral-950/95", FADE)} />
        <Dialog.Content
          ref={content}
          onOpenAutoFocus={(event) => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            // Focus the lightbox itself, not its first focusable element: that's the comment when
            // it's cut off, and focusing it would open it over the details.
            event.preventDefault();
            content.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className={cn("fixed inset-0 z-50 flex flex-col text-white outline-none", FADE)}
        >
          {photo && (
            <>
              <div className="flex items-center gap-4 p-4">
                <LightboxCaption photo={photo} />
                <Dialog.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close"
                    className="text-white hover:bg-white/10 hover:text-white"
                  >
                    <XIcon />
                  </Button>
                </Dialog.Close>
              </div>
              {/* A size container, so the photo can be fitted to it with cqw and cqh. */}
              <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
                <div className="flex size-full items-center justify-center [container-type:size]">
                  <LightboxImage key={photo.id} image={photo.image} alt={photo.title} />
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The photo's title, with its comment and then its settings, camera, date and place beside it. */
function LightboxCaption({ photo }: { photo: Photo }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Dialog.Title className="truncate font-medium">{photo.title}</Dialog.Title>
      {/* One row, so the details take no room from the photo; it wraps only on narrow screens. */}
      <div className="flex flex-wrap items-baseline gap-x-4 text-sm">
        {/* One line, so a long comment can't make the photo smaller. */}
        {photo.comment && (
          <PhotoComment
            comment={photo.comment}
            lines={1}
            className="text-white/80"
            expandedClassName="bg-neutral-900 ring-1 ring-white/15"
          />
        )}
        <Dialog.Description className="max-w-full min-w-0 truncate text-white/60">
          {[...settingsText(photo.settings), photo.camera, format(photo.takenAt, "MMM d, yyyy")]
            .filter(Boolean)
            .join(" · ")}
          {photo.location && (
            <>
              {" · "}
              <PhotoLocation
                location={photo.location}
                detailsClassName="bg-neutral-800 text-white ring-1 ring-white/15"
              />
            </>
          )}
        </Dialog.Description>
      </div>
    </div>
  );
}

/** Whether img has already loaded, as a cached image can before React listens for it. */
function isLoaded(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0);
}

/**
 * The photo, fitted to its container, with the photo's preview blurred under it until it loads.
 * The browser picks the version from the srcset by how wide the photo is shown, roughly the
 * window's width or its height times the photo's aspect ratio, whichever is smaller.
 */
function LightboxImage({ image, alt }: { image: PhotoImage; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const ratio = image.width / image.height;
  return (
    <div
      className="relative overflow-hidden"
      style={{
        aspectRatio: `${image.width} / ${image.height}`,
        width: `min(100cqw, 100cqh * ${ratio})`,
      }}
    >
      {image.preview && (
        <img
          src={image.preview}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-110 object-cover blur-xl"
        />
      )}
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={`min(100vw, ${Math.round(ratio * 100)}vh)`}
        width={image.width}
        height={image.height}
        alt={alt}
        ref={(img) => {
          if (isLoaded(img)) setLoaded(true);
        }}
        onLoad={() => setLoaded(true)}
        className={cn(
          "relative size-full object-contain transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
