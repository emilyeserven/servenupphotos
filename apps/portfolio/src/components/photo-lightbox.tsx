import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, EyeOffIcon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLocation } from "@/components/photo-location";
import { Button } from "@/components/ui/button";
import { viewOnMapLink } from "@/components/view-on-map-link";
import { settingsText, type Photo, type PhotoImage } from "@/lib/photos";
import { useSwipe } from "@/lib/use-swipe";
import { cn } from "@/lib/utils";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

interface PhotoLightboxProps {
  /** The photo to show, or null when the lightbox is closed. */
  photo: ImagePhoto | null;
  /**
   * The photos the previous and next buttons, the Left and Right arrow keys and swiping move through, in
   * the order the view shows them. Photos without an image are skipped. Left out, there's only the
   * one photo.
   */
  photos?: readonly Photo[];
  /** Shows another photo from photos, when the previous or next button or arrow key is pressed or the photo is swiped. */
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
  // Set when the details and buttons are hidden, leaving only the photo, as large as the window.
  const [bare, setBare] = useState(false);
  function toggleBare() {
    setBare(!bare);
    // The hide button goes away, so the lightbox keeps the focus and still hears the keys.
    content.current?.focus();
  }
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
            setBare(false);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          onKeyDown={(event) => runKey(event, { ...steps.keys, h: toggleBare, H: toggleBare })}
          className={cn("fixed inset-0 z-50 flex flex-col text-white outline-none", FADE)}
        >
          {photo && (
            <LightboxBody photo={photo} steps={steps} bare={bare} onToggleBare={toggleBare} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Runs the step for the key pressed, if there is one, instead of what the key would do. */
function runKey(event: KeyboardEvent, keys: Record<string, (() => void) | undefined>) {
  const step = keys[event.key];
  if (!step) return;
  event.preventDefault();
  step();
}

interface LightboxBodyProps {
  photo: ImagePhoto;
  steps: Steps;
  /** Set when only the photo is shown, without the details and buttons. */
  bare: boolean;
  /** Hides the details and buttons, or shows them again, from the hide button or a click on the photo. */
  onToggleBare: () => void;
}

/**
 * The caption and buttons over the photo, with the previous and next buttons beside it, or just
 * the photo, filling the window, when they're hidden.
 */
function LightboxBody({ photo, steps, bare, onToggleBare }: LightboxBodyProps) {
  return (
    <>
      {!bare && <LightboxHeader photo={photo} position={steps.position} onHide={onToggleBare} />}
      <LightboxPhotoRow photo={photo} steps={steps} bare={bare} onToggleBare={onToggleBare} />
    </>
  );
}

/**
 * The photo, with the previous and next buttons over its sides while it's hovered, or on its own,
 * filling the window, when bare. Swiping left or right on it moves to the next or previous photo.
 */
function LightboxPhotoRow({ photo, steps, bare, onToggleBare }: LightboxBodyProps) {
  const swipe = useSwipe((by) => (by < 0 ? steps.previous : steps.next)?.());
  return (
    <div
      {...swipe}
      className={cn("flex min-h-0 flex-1 items-center justify-center", bare ? "p-0" : "p-4 pt-0")}
    >
      {/* A size container, so the photo can be fitted to it with cqw and cqh. Clicking it hides
          the details or shows them again. */}
      <div
        onClick={onToggleBare}
        className="flex size-full items-center justify-center [container-type:size]"
      >
        <LightboxImage key={photo.id} image={photo.image} alt={photo.title}>
          {!bare && <StepButton direction="previous" steps={steps} />}
          {!bare && <StepButton direction="next" steps={steps} />}
        </LightboxImage>
      </div>
    </div>
  );
}

/** The photo's caption, where it is among the photos, and the hide and close buttons. */
function LightboxHeader({
  photo,
  position,
  onHide,
}: {
  photo: ImagePhoto;
  position?: string;
  onHide: () => void;
}) {
  return (
    <div className="flex items-center gap-4 p-4">
      <LightboxCaption photo={photo} />
      <span className="shrink-0 text-sm text-white/60 tabular-nums empty:hidden">{position}</span>
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide details"
          title="Hide details (H); click the photo to show them again"
          onClick={onHide}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <EyeOffIcon />
        </Button>
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
    </div>
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
  /** The Left and Right arrow keys' steps, by key name. */
  keys: Record<string, (() => void) | undefined>;
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
  return {
    previous,
    next,
    position: positionText(index, showable.length),
    keys: { ArrowLeft: previous, ArrowRight: next },
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

/** Each step button's name, icon and side of the photo. */
const STEP_LOOKS = {
  previous: { label: "Previous photo", Icon: ChevronLeftIcon, side: "left-2" },
  next: { label: "Next photo", Icon: ChevronRightIcon, side: "right-2" },
};

/**
 * The previous or next button over the photo's side, shown while the photo is hovered or the
 * button has the keyboard focus, and always on touch screens, which can't hover. It's left out at
 * that end and for a photo on its own.
 */
function StepButton({ direction, steps }: { direction: "previous" | "next"; steps: Steps }) {
  const onStep = steps[direction];
  if (!steps.position || !onStep) return null;
  const { label, Icon, side } = STEP_LOOKS[direction];
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={(event) => {
        // Not a click on the photo, which would hide the details.
        event.stopPropagation();
        onStep();
      }}
      className={cn(
        "absolute top-1/2 size-10 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60 hover:text-white focus-visible:opacity-100 pointer-coarse:opacity-100",
        side,
      )}
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
              >
                {viewOnMapLink(photo)}
              </PhotoLocation>
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
function LightboxImage({
  image,
  alt,
  children,
}: {
  image: PhotoImage;
  alt: string;
  /** Shown over the photo, such as the previous and next buttons. */
  children?: ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const ratio = image.width / image.height;
  return (
    <div
      className="group relative overflow-hidden"
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
      {children}
    </div>
  );
}
