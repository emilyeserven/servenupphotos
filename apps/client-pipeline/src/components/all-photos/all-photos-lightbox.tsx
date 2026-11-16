import type { KeyboardEvent } from "react";
import { type AllPhotosEntry, fullImageUrl } from "@/components/all-photos/all-photos-files";
import { EditButton, KIND_MARKS } from "@/components/all-photos/all-photos-grid";
import { ImageLightbox } from "@/components/image-lightbox";
import { focusLightboxPhoto, LightboxSideArrows } from "@/components/lightbox-side-arrows";
import { steppedPath } from "@/lib/compare-keys";
import { arrowStep } from "@/lib/social-feed";

interface AllPhotosLightboxProps {
  /** The photos shown on the page, in its sort; the ones without an image in R2 are skipped. */
  entries: AllPhotosEntry[];
  /** The path of the photo shown full size, or null while closed. */
  openPath: string | null;
  /** Shows another photo, or closes with null. */
  onOpenPath: (path: string | null) => void;
}

/**
 * The All Photos page's photos full size, one at a time: ← and → (or the arrows at the sides) move
 * through every photo the page shows, in its sort and going round, and Esc closes. Closing puts
 * focus back on the tile of the photo last shown.
 */
export function AllPhotosLightbox({ entries, openPath, onOpenPath }: AllPhotosLightboxProps) {
  const openable = entries.filter((entry) => fullImageUrl(entry));
  const index = openable.findIndex((entry) => entry.path === openPath);
  const entry = openable[index];
  const src = entry && fullImageUrl(entry);
  if (!entry || !src) return null;
  return (
    <OpenLightbox
      paths={openable.map((each) => each.path)}
      index={index}
      entry={entry}
      src={src}
      onOpenPath={onOpenPath}
    />
  );
}

interface OpenLightboxProps {
  /** The paths of the photos it steps through, in the page's sort. */
  paths: string[];
  /** The place in paths of the photo shown, 0 first. */
  index: number;
  entry: AllPhotosEntry;
  src: string;
  onOpenPath: (path: string | null) => void;
}

function OpenLightbox({ paths, index, entry, src, onOpenPath }: OpenLightboxProps) {
  const step = (by: number) => onOpenPath(steppedPath(paths, entry.path, by));
  const place = `${index + 1} of ${paths.length}`;
  return (
    <ImageLightbox
      open
      onClose={() => onOpenPath(null)}
      title={entry.name}
      src={src}
      description={`${entry.name} at full size, photo ${place}. The left and right arrow keys move between the photos.`}
      toolbar={<Toolbar entry={entry} place={place} />}
      overlay={paths.length > 1 && <LightboxSideArrows onStep={step} />}
      footer={<Footer entry={entry} />}
      onKeyDown={(event) => stepByKey(event, step)}
      onCloseAutoFocus={(event) => focusLightboxPhoto(event, entry.path)}
    />
  );
}

/** Calls step with -1 for ← and 1 for →, keeping the key from scrolling the page; other keys do nothing. */
function stepByKey(event: KeyboardEvent<HTMLDivElement>, step: (by: number) => void) {
  const by = arrowStep(event);
  if (by === 0) return;
  event.preventDefault();
  step(by);
}

/** The photo's Draft or Undecided mark, if it has one, and its place among the photos. */
function Toolbar({ entry, place }: { entry: AllPhotosEntry; place: string }) {
  const mark = entry.kind === "published" ? undefined : KIND_MARKS[entry.kind];
  return (
    <>
      {mark && (
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${mark.className}`}>
          {mark.label}
        </span>
      )}
      <span className="text-sm text-white/70">{place}</span>
    </>
  );
}

/** Edit for the photo shown, and the keys, in the dark theme. */
function Footer({ entry }: { entry: AllPhotosEntry }) {
  return (
    <div className="dark flex flex-wrap items-center justify-center gap-2 p-4 pt-0">
      <EditButton entry={entry} />
      <span className="text-xs text-white/60">← → to move · Esc to close</span>
    </div>
  );
}
