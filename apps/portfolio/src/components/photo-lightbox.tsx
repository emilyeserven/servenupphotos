import { format } from "date-fns";
import { XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Photo, PhotoImage } from "@/lib/photos";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  /** The photo to show, or null when the lightbox is closed. */
  photo: (Photo & { image: PhotoImage }) | null;
  onClose: () => void;
}

/** A full-window overlay showing a whole photo, as large as fits the window. */
export function PhotoLightbox({ photo, onClose }: PhotoLightboxProps) {
  // The tile that opened it, to focus again on closing, as there's no Dialog.Trigger to go back to.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={photo !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/95" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none"
        >
          {photo && (
            <>
              <div className="flex items-center gap-4 p-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <Dialog.Title className="truncate font-medium">{photo.title}</Dialog.Title>
                  <Dialog.Description className="truncate text-sm text-white/60">
                    {format(photo.takenAt, "MMM d, yyyy")} · {photo.location}
                  </Dialog.Description>
                </div>
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
