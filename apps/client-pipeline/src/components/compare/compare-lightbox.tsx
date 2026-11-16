import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { LowerTierButton } from "@/components/compare/lower-tier-button";
import { WinnerButton } from "@/components/compare/winner-button";
import { ImageLightbox } from "@/components/image-lightbox";
import { useSetLowerTier } from "@/components/lower-tier";
import { Button } from "@/components/ui/button";
import { useCompareEdits } from "@/hooks/use-compare-groups";
import {
  type ComparePhoto,
  compareFullUrl,
  comparePhotoName,
  isWinner,
} from "@/lib/compare-groups";
import {
  type CompareKeyAction,
  LOWER_TIER_KEY,
  WINNER_KEY,
  compareKeyAction,
  steppedPath,
} from "@/lib/compare-keys";
import { isLowerTier } from "@/lib/lower-tier";

interface CompareLightboxProps {
  /** The group's photos, in the order they're shown on the page. */
  photos: ComparePhoto[];
  /** The path of the photo shown full size, or null while closed. */
  openPath: string | null;
  /** Shows another photo of the group, or closes with null. */
  onOpenPath: (path: string | null) => void;
}

/**
 * A compare group's photos full size, one at a time: ← and → (or the arrows at the sides) move
 * between them, going round, and W and L pick the one shown as a winner or flip its Lower Tier,
 * as its buttons under it do. Closing puts focus back on that photo's image on the page.
 */
export function CompareLightbox({ photos, openPath, onOpenPath }: CompareLightboxProps) {
  const index = photos.findIndex((photo) => photo.file.path === openPath);
  const photo = photos[index];
  const src = photo && compareFullUrl(photo);
  if (!photo || !src) return null;
  return (
    <OpenLightbox photos={photos} index={index} src={src} photo={photo} onOpenPath={onOpenPath} />
  );
}

interface OpenLightboxProps {
  photos: ComparePhoto[];
  /** The place in photos of the photo shown, 0 first. */
  index: number;
  photo: ComparePhoto;
  src: string;
  onOpenPath: (path: string | null) => void;
}

function OpenLightbox({ photos, index, photo, src, onOpenPath }: OpenLightboxProps) {
  const name = comparePhotoName(photo);
  const step = (by: number) => onOpenPath(steppedPath(paths(photos), photo.file.path, by));
  const onKeyDown = useCompareKeys(photo, step);
  const place = `${index + 1} of ${photos.length}`;
  return (
    <ImageLightbox
      open
      onClose={() => onOpenPath(null)}
      title={name}
      src={src}
      description={`${name} at full size, photo ${place}. The left and right arrow keys move between the group's photos.`}
      toolbar={<span className="text-sm text-white/70">{place}</span>}
      overlay={photos.length > 1 && <SideArrows onStep={step} />}
      footer={<LightboxActions photo={photo} />}
      onKeyDown={onKeyDown}
      onCloseAutoFocus={(event) => focusPhoto(event, photo.file.path)}
    />
  );
}

function paths(photos: ComparePhoto[]): string[] {
  return photos.map((photo) => photo.file.path);
}

/** The key handler: arrows call step, W and L act on the photo shown. */
function useCompareKeys(photo: ComparePhoto, step: (by: number) => void) {
  const { setWinner } = useCompareEdits();
  const setLowerTier = useSetLowerTier();
  const run: Record<NonNullable<CompareKeyAction>["kind"], (by: number) => void> = {
    step,
    winner: () => setWinner(photo, !isWinner(photo)),
    lowerTier: () => setLowerTier([photo.file], !isLowerTier(photo.data)),
  };
  return (event: KeyboardEvent<HTMLDivElement>) => {
    const action = compareKeyAction(event);
    if (!action) return;
    event.preventDefault();
    run[action.kind](action.kind === "step" ? action.step : 0);
  };
}

/** Moves focus to the image of the photo last shown, instead of the one first clicked. */
function focusPhoto(event: Event, path: string) {
  const image = document.querySelector<HTMLElement>(`[data-compare-photo="${CSS.escape(path)}"]`);
  if (!image) return;
  event.preventDefault();
  image.focus();
}

/** Previous and Next buttons at the image's sides, for a mouse or a touch screen. */
function SideArrows({ onStep }: { onStep: (by: number) => void }) {
  const className =
    "absolute top-1/2 size-12 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white [&_svg]:size-7";
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous photo"
        aria-keyshortcuts="ArrowLeft"
        title="Previous photo (←)"
        className={`${className} left-6`}
        onClick={() => onStep(-1)}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next photo"
        aria-keyshortcuts="ArrowRight"
        title="Next photo (→)"
        className={`${className} right-6`}
        onClick={() => onStep(1)}
      >
        <ChevronRightIcon />
      </Button>
    </>
  );
}

/** Pick as winner and Lower Tier for the photo shown, with their keys, in the dark theme. */
function LightboxActions({ photo }: { photo: ComparePhoto }) {
  return (
    <div className="dark flex flex-wrap items-center justify-center gap-2 p-4 pt-0">
      <WinnerButton photo={photo} shortcut={WINNER_KEY} />
      <LowerTierButton photo={photo} shortcut={LOWER_TIER_KEY} />
      <span className="text-xs text-white/60">
        ← → to move · W winner · L Lower Tier · Esc to close
      </span>
    </div>
  );
}
