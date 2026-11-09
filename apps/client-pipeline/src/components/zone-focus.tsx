import { useState } from "react";
import type { SocialCalendar, SocialPhoto } from "@/api/publish";
import { photoName } from "@/components/group-photo-grid";
import { PhotoFiles } from "@/components/photo-files";
import { SpotlightFocus } from "@/components/spotlight-focus";
import type { CombinedPhoto } from "@/lib/group-photos";
import type { SpotlightZone } from "@/lib/site-spotlight";
import { wholePhoto } from "@/lib/spotlight-focus-edits";
import { cn } from "@/lib/utils";
import { SPOTLIGHT_ZONE_FOCUS } from "@/lib/photo-fields";

interface ZoneFocusProps {
  zone: SpotlightZone;
  /** The photos the zone shows, in its album's order. */
  photos: CombinedPhoto[];
}

/**
 * The photos the zone shows, each a button that picks it, and the picked photo's focus point in
 * the zone, set here rather than on the Photo page since each zone crops a photo its own way.
 */
export function ZoneFocus({ zone, photos }: ZoneFocusProps) {
  return (
    <PhotoFiles>{(files) => <Picker zone={zone} files={zoneFiles(files, photos)} />}</PhotoFiles>
  );
}

/** The photo files of the photos, in their order, leaving out ones without a file or an image. */
function zoneFiles(files: SocialCalendar, photos: CombinedPhoto[]): SocialPhoto[] {
  const byId = new Map(files.photos.map((file) => [file.data.id, file]));
  return photos.flatMap((photo) => byId.get(photo.id) ?? []).filter((file) => wholePhoto(file));
}

function Picker({ zone, files }: { zone: SpotlightZone; files: SocialPhoto[] }) {
  const [path, setPath] = useState<string>();
  const picked = files.find((file) => file.path === path) ?? files[0];
  if (!picked) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">Focus spots</p>
      <ul className="flex flex-wrap gap-2" aria-label="Pick a photo to set its focus point">
        {files.map((file) => (
          <li key={file.path}>
            <Thumb file={file} zone={zone.id} on={file === picked} onPick={setPath} />
          </li>
        ))}
      </ul>
      <SpotlightFocus key={picked.path} photo={picked} zone={zone} />
    </div>
  );
}

interface ThumbProps {
  file: SocialPhoto;
  zone: string;
  on: boolean;
  onPick: (path: string) => void;
}

/** One photo as a small square, ringed when picked, with a dot when it has its own focus point here. */
function Thumb({ file, zone, on, onPick }: ThumbProps) {
  const name = photoName(file.data);
  return (
    <button
      type="button"
      aria-pressed={on}
      title={name}
      onClick={() => onPick(file.path)}
      className={cn(
        "relative block size-16 overflow-hidden rounded-md border-2",
        on ? "border-primary" : "border-transparent",
      )}
    >
      <img src={file.image ?? undefined} alt={name} className="size-full object-cover" />
      {hasOwnFocus(file.data, zone) && (
        <span
          aria-label="Has its own focus point"
          className="bg-primary absolute right-1 bottom-1 size-2.5 rounded-full ring-2 ring-white"
        />
      )}
    </button>
  );
}

/** Whether the saved photo file has its own focus point for the zone. */
function hasOwnFocus(data: Record<string, unknown>, zone: string): boolean {
  const saved = data[SPOTLIGHT_ZONE_FOCUS];
  return typeof saved === "object" && saved !== null && zone in saved;
}
