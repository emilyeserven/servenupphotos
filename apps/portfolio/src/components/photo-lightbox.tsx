import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, EyeOffIcon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { CopyPhotoLinkButton } from "@/components/copy-photo-link-button";
import { LikeBurst, LikeButton } from "@/components/like-button";
import { MoreLikeThis, toggleMoreLikeThis } from "@/components/more-like-this";
import { PhotoComment } from "@/components/photo-comment";
import { PhotoLocation } from "@/components/photo-location";
import { Button } from "@/components/ui/button";
import { viewOnMapLink } from "@/components/view-on-map-link";
import { like } from "@/lib/likes";
import { settingsText, type Photo, type PhotoImage } from "@/lib/photos";
import { useSwipe } from "@/lib/use-swipe";
import { useTaps } from "@/lib/use-taps";
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
          onKeyDown={(event) =>
            runKey(event, { ...steps.keys, ...drawerKeys(bare), h: toggleBare, H: toggleBare })
          }
          className={cn("fixed inset-0 z-50 flex flex-col text-white outline-none", FADE)}
        >
          {photo && (
            <LightboxBody
              photo={photo}
              steps={steps}
              bare={bare}
              onToggleBare={toggleBare}
              onShow={onShow}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The M key, which opens or closes the More like this drawer, while it's shown (not bare). */
function drawerKeys(bare: boolean): Record<string, () => void> {
  return bare ? {} : { m: toggleMoreLikeThis, M: toggleMoreLikeThis };
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
  /** Hides the details and buttons from the hide button, or shows them again from a tap on the photo. */
  onToggleBare: () => void;
  /** Shows another photo, such as one from the More like this drawer, which is left out without it. */
  onShow?: (photo: ImagePhoto) => void;
}

/**
 * The caption and buttons over the photo, with the previous and next buttons beside it and the
 * More like this drawer to its left, or just the photo, filling the window, when they're hidden.
 */
function LightboxBody({ photo, steps, bare, onToggleBare, onShow }: LightboxBodyProps) {
  const showDetails = !bare;
  return (
    <>
      {showDetails && (
        <LightboxHeader photo={photo} position={steps.position} onHide={onToggleBare} />
      )}
      <div className="relative flex min-h-0 flex-1">
        {showDetails && onShow && <MoreLikeThis photo={photo} onShow={onShow} />}
        <LightboxPhotoRow photo={photo} steps={steps} bare={bare} onToggleBare={onToggleBare} />
      </div>
    </>
  );
}

/**
 * The photo, with the previous and next buttons over its sides while it's hovered, or on its own,
 * filling the window, when bare. Swiping left or right on it moves to the next or previous photo,
 * and double tapping (or double clicking) it likes it. A single tap does nothing while the
 * details show, and shows them again when bare.
 */
function LightboxPhotoRow({ photo, steps, bare, onToggleBare }: LightboxBodyProps) {
  const swipe = useSwipe((by) => (by < 0 ? steps.previous : steps.next)?.());
  const { onTap, burst, onBurstDone } = useDoubleTapLike(photo.id, bare ? onToggleBare : undefined);
  return (
    <div
      {...swipe}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 items-center justify-center",
        bare ? "p-0" : "p-4 pt-0",
      )}
    >
      {/* A size container, so the photo can be fitted to it with cqw and cqh. It hears the taps;
          touch-action stops a double tap from zooming the page, but not pinch-zooming. */}
      <div
        onClick={onTap}
        className="flex size-full touch-manipulation items-center justify-center select-none [container-type:size]"
      >
        <LightboxImage key={photo.id} image={photo.image} alt={photo.alt}>
          {burst !== null && <LikeBurst key={burst} onDone={onBurstDone} />}
          <StepButtons steps={steps} bare={bare} />
        </LightboxImage>
      </div>
    </div>
  );
}

/** The previous and next buttons over the photo's sides, left out when bare. */
function StepButtons({ steps, bare }: { steps: Steps; bare: boolean }) {
  if (bare) return null;
  return (
    <>
      <StepButton direction="previous" steps={steps} />
      <StepButton direction="next" steps={steps} />
    </>
  );
}

/**
 * The photo's tap handler: a double tap likes the photo and pops a heart over it, and a single tap
 * runs onSingle, if there is one, once it's clear it isn't a double tap.
 */
function useDoubleTapLike(id: number, onSingle: (() => void) | undefined) {
  // Counts double taps, so each one pops a new heart; null once the last heart has faded.
  const [burst, setBurst] = useState<number | null>(null);
  const onTap = useTaps({
    onSingle,
    onDouble: () => {
      like(id);
      setBurst((count) => (count ?? 0) + 1);
    },
  });
  return { onTap, burst, onBurstDone: () => setBurst(null) };
}

/** The photo's caption, where it is among the photos, and the like, hide and close buttons. */
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
        <CopyPhotoLinkButton id={photo.id} />
        <LikeButton id={photo.id} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hide details"
          title="Hide details (H); tap the photo to show them again"
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
 * button has the keyboard focus. Touch screens, which can't hover, swipe instead and don't show it.
 * It's left out at that end and for a photo on its own.
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
        // Not a tap on the photo, which counts toward a double tap.
        event.stopPropagation();
        onStep();
      }}
      className={cn(
        "absolute top-1/2 size-10 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60 hover:text-white focus-visible:opacity-100 pointer-coarse:hidden",
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
