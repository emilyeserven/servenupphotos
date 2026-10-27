import { useQuery } from "@tanstack/react-query";
import { organizeQuery } from "@/api/organize";
import type { SocialPhoto } from "@/api/publish";
import { SpotlightPlacement } from "@/components/spotlight-placement";
import { type PreviewPhoto, SpotlightPreview } from "@/components/spotlight-preview";
import { Button } from "@/components/ui/button";
import {
  type Focus,
  SPOTLIGHT_FOCUS,
  SPOTLIGHT_PLACEMENT,
  clickedFocus,
  focusChange,
  focusOf,
  wholePhoto,
} from "@/lib/spotlight-focus";
import { hasSpotlightAlbum } from "@/lib/site-spotlight";
import { previewOf } from "@/lib/spotlight-preview";
import { useLocalEditsStore } from "@/stores/local-edits";

/**
 * The photo's focus point: where to click on it to keep that part in view when a spotlight zone
 * crops it to a screen of the other shape, such as a landscape photo behind the homepage on a phone,
 * and where on the screen that point goes.
 * It's a local edit until **Commit**, like the zones, with a preview of the photo behind the
 * homepage on a phone and a computer once an album is picked for a zone on Site Spotlight.
 */
export function SpotlightFocus({ photo }: { photo: SocialPhoto }) {
  const edits = useLocalEditsStore((state) => state.edits);
  const setField = useLocalEditsStore((state) => state.setField);
  const focus = focusOf(edits, photo);
  const placement = focusOf(edits, photo, SPOTLIGHT_PLACEMENT);
  const set = (next: Focus | null) => setField(SPOTLIGHT_FOCUS, [focusChange(photo, next)]);
  const place = (next: Focus | null) => setField(SPOTLIGHT_PLACEMENT, [focusChange(photo, next)]);
  const src = wholePhoto(photo);
  if (!src) return null;
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Focus point</p>
        <Button variant="outline" size="sm" disabled={!focus} onClick={() => set(null)}>
          Use the middle
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Click the part to keep in view on a screen of the other shape: a phone showing a landscape
        photo, or a computer a portrait one.
      </p>
      <FocusPicker src={src} focus={focus} onPick={set} />
      <SpotlightPlacement placement={placement} onPick={place} />
      <HomepagePreview photo={previewOf(photo.data, src, focus, placement)} />
    </div>
  );
}

interface FocusPickerProps {
  src: string;
  focus: Focus | null;
  onPick: (focus: Focus) => void;
}

/** The whole photo, with a ring on its focus; a click moves the focus there. */
function FocusPicker({ src, focus, onPick }: FocusPickerProps) {
  const at = focus ?? { x: 50, y: 50 };
  return (
    <button
      type="button"
      aria-label={`Focus point, now at ${at.x}% across and ${at.y}% down. Click to move it`}
      className="relative block w-full cursor-crosshair overflow-hidden rounded-md border"
      onClick={(event) =>
        onPick(
          clickedFocus(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()),
        )
      }
    >
      <img src={src} alt="" draggable={false} className="block w-full" />
      <span
        aria-hidden
        className="pointer-events-none absolute size-6 -translate-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgb(0_0_0/0.5)]"
        style={{ left: `${at.x}%`, top: `${at.y}%` }}
      />
    </button>
  );
}

/** The photo behind the homepage, shown only once an album is picked for a spotlight zone. */
function HomepagePreview({ photo }: { photo: PreviewPhoto }) {
  const organize = useQuery(organizeQuery);
  if (!organize.data || !hasSpotlightAlbum(organize.data.albums)) return null;
  return (
    <>
      <p className="pt-1 text-sm font-medium">Behind the homepage</p>
      <SpotlightPreview photo={photo} />
    </>
  );
}
