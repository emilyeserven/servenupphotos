import type { SocialPhoto } from "@/api/publish";
import { HeaderPreview } from "@/components/header-preview";
import { SpotlightPlacement } from "@/components/spotlight-placement";
import { SpotlightPreview } from "@/components/spotlight-preview";
import { Button } from "@/components/ui/button";
import type { SpotlightZone } from "@/lib/site-spotlight";
import {
  type Focus,
  SPOTLIGHT_ZONE_FOCUS,
  clickedFocus,
  editedData,
  wholePhoto,
  zoneFocusChange,
  zoneFocusOf,
} from "@/lib/spotlight-focus-edits";
import { previewOf } from "@/lib/spotlight-preview";
import { useLocalEditsStore } from "@/stores/local-edits";
import type { ZoneFocus } from "@portfolio/lib/photos";

/**
 * The photo's focus point in the zone: where to click on it to keep that part in view when the
 * zone crops it, such as a landscape photo behind the homepage on a phone, and where on the screen
 * that point goes, with a preview of the zone on a phone and a computer. Each zone keeps its own.
 * It's a local edit until **Commit**, like the zones.
 */
export function SpotlightFocus({ photo, zone }: { photo: SocialPhoto; zone: SpotlightZone }) {
  const edits = useLocalEditsStore((state) => state.edits);
  const setField = useLocalEditsStore((state) => state.setField);
  const data = editedData(edits, photo);
  const current = zoneFocusOf(data, zone.id);
  const save = (next: Partial<ZoneFocus>) =>
    setField(SPOTLIGHT_ZONE_FOCUS, [
      zoneFocusChange(photo, data, zone.id, { ...current, ...next }),
    ]);
  const src = wholePhoto(photo);
  if (!src) return null;
  const preview = previewOf(photo.data, src, current.focus, current.placement);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Focus point</p>
        <Button
          variant="outline"
          size="sm"
          disabled={!current.focus}
          onClick={() => save({ focus: null })}
        >
          Use the middle
        </Button>
      </div>
      <p className="text-muted-foreground">
        Click the part of the photo to keep in view where {zone.label} crops it.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-3">
          <FocusPicker src={src} focus={current.focus} onPick={(focus) => save({ focus })} />
          <SpotlightPlacement
            placement={current.placement}
            onPick={(placement) => save({ placement })}
          />
        </div>
        {zone.homepage ? <SpotlightPreview photo={preview} /> : <HeaderPreview photo={preview} />}
      </div>
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
