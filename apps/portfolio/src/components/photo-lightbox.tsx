import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { type KeyboardEvent, useRef, useState } from "react";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLocation } from "@/components/photo-location";
import { Button } from "@/components/ui/button";
import { settingsText, type Photo, type PhotoImage } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

interface PhotoLightboxProps {
  /** The photo to show, or null when the lightbox is closed. */
  photo: ImagePhoto | null;
  /**
   * The photos the previous and next buttons and the Left and Right arrow keys move through, in
   * the order the view shows them. Photos without an image are skipped. Left out, there's only the
   * one photo.
   */
  photos?: readonly Photo[];
  /** Shows another photo from photos, when the previous or next button or arrow key is pressed. */
  onShow?: (photo: ImagePhoto) => void;
  onClose: () => void;
}

// A quick fade in on opening and out on closing, for both the overlay and the content.
const FADE =
  "duration-250 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

/** A full-window overlay showing a whole photo, as large as fits the window. */
export function PhotoLightbox({
  photo: openPhoto,
  photos = [],
  onShow,
  onClose,
}: PhotoLightboxProps) {
  // The last photo shown, kept while the lightbox fades out after photo goes back to null.
  const [photo, setPhoto] = useState(openPhoto);
  if (openPhoto && openPhoto !== photo) setPhoto(openPhoto);
  // The tile that opened it, to focus again on closing, as there's no Dialog.Trigger to go back to.
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const steps = useSteps(photos, photo, onShow);
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
          onKeyDown={steps.onKeyDown}
          className={cn("fixed inset-0 z-50 flex flex-col text-white outline-none", FADE)}
        >
          {photo && <LightboxBody photo={photo} steps={steps} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The caption and close button over the photo, with the previous and next buttons beside it. */
function LightboxBody({ photo, steps }: { photo: ImagePhoto; steps: Steps }) {
  return (
    <>
      <div className="flex items-center gap-4 p-4">
        <LightboxCaption photo={photo} />
        <span className="shrink-0 text-sm text-white/60 tabular-nums empty:hidden">
          {steps.position}
        </span>
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
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 p-4 pt-0">
        <StepButton direction="previous" steps={steps} />
        {/* A size container, so the photo can be fitted to it with cqw and cqh. */}
        <div className="flex size-full items-center justify-center [container-type:size]">
          <LightboxImage key={photo.id} image={photo.image} alt={photo.title} />
        </div>
        <StepButton direction="next" steps={steps} />
      </div>
    </>
  );
}

function hasImage(photo: Photo): photo is ImagePhoto {
  return photo.image !== null;
}

/** Moving to the previous and next photos, each undefined at that end or when there's only one photo. */
interface Steps {
  previous?: () => void;
  next?: () => void;
  /** Where the photo is among them, such as "3 / 20", when there's more than one. */
  position?: string;
  /** Moves with the Left and Right arrow keys. */
  onKeyDown: (event: KeyboardEvent) => void;
}

/** The photos before and after shown's place among photos, by id, as each view makes its own copies. */
function useSteps(
  photos: readonly Photo[],
  shown: ImagePhoto | null,
  onShow: ((photo: ImagePhoto) => void) | undefined,
): Steps {
  const showable = photos.filter(hasImage);
  const index = showable.findIndex((photo) => photo.id === shown?.id);
  const stepTo = (to: number) => stepper(showable[to], onShow);
  const previous = stepTo(index - 1);
  const next = stepTo(index + 1);
  const keys: Record<string, (() => void) | undefined> = { ArrowLeft: previous, ArrowRight: next };
  return {
    previous,
    next,
    position: positionText(index, showable.length),
    onKeyDown: (event) => {
      const step = keys[event.key];
      if (!step) return;
      event.preventDefault();
      step();
    },
  };
}

/** Shows photo, or undefined when there's no photo there to show. */
function stepper(
  photo: ImagePhoto | undefined,
  onShow: ((photo: ImagePhoto) => void) | undefined,
): (() => void) | undefined {
  if (!photo || !onShow) return undefined;
  return () => onShow(photo);
}

/** "3 / 20" for the third of twenty photos, or undefined when it's the only one or isn't among them. */
function positionText(index: number, count: number): string | undefined {
  if (index < 0 || count < 2) return undefined;
  return `${index + 1} / ${count}`;
}

/** The previous or next button beside the photo, disabled at that end and left out for a photo on its own. */
function StepButton({ direction, steps }: { direction: "previous" | "next"; steps: Steps }) {
  if (!steps.position) return null;
  const onStep = steps[direction];
  const Icon = direction === "previous" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={direction === "previous" ? "Previous photo" : "Next photo"}
      disabled={!onStep}
      onClick={onStep}
      className="shrink-0 text-white hover:bg-white/10 hover:text-white disabled:opacity-25"
    >
      <Icon className="size-6" />
    </Button>
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
        fetchPriority="high"
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
