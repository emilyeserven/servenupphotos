import type { SocialPhoto } from "@/api/publish";
import { Button } from "@/components/ui/button";
import {
  type Focus,
  SPOTLIGHT_FOCUS,
  clickedFocus,
  focusChange,
  focusOf,
  objectPosition,
  wholePhoto,
} from "@/lib/spotlight-focus";
import { useLocalEditsStore } from "@/stores/local-edits";

/**
 * The photo's focus point: where to click on it to keep that part in view when a spotlight zone
 * crops it to a screen of the other shape, such as a landscape photo behind the homepage on a phone.
 * It's a local edit until **Commit**, like the zones, with previews of a phone and a computer.
 */
export function SpotlightFocus({ photo }: { photo: SocialPhoto }) {
  const edits = useLocalEditsStore((state) => state.edits);
  const setField = useLocalEditsStore((state) => state.setField);
  const focus = focusOf(edits, photo);
  const set = (next: Focus | null) => setField(SPOTLIGHT_FOCUS, [focusChange(photo, next)]);
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
      <FocusPreviews src={src} focus={focus} />
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

/** How the photo is cropped with the focus, on a phone held upright and on a computer. */
function FocusPreviews({ src, focus }: { src: string; focus: Focus | null }) {
  const style = { objectPosition: objectPosition(focus) };
  return (
    <div className="flex items-end gap-3">
      <figure className="flex flex-col gap-1">
        <img
          src={src}
          alt=""
          style={style}
          className="aspect-[9/19] w-14 rounded-sm object-cover"
        />
        <figcaption className="text-muted-foreground text-xs">Phone</figcaption>
      </figure>
      <figure className="flex flex-col gap-1">
        <img
          src={src}
          alt=""
          style={style}
          className="aspect-[16/10] w-44 rounded-sm object-cover"
        />
        <figcaption className="text-muted-foreground text-xs">Computer</figcaption>
      </figure>
    </div>
  );
}
