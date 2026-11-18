import type { KeyboardEvent } from "react";
import { type GalleryFile, fullImageUrl } from "@/components/gallery/gallery-files";
import { EditButton, KIND_MARKS } from "@/components/gallery/kind-mark";
import { ImageLightbox } from "@/components/image-lightbox";
import { focusLightboxPhoto, LightboxSideArrows } from "@/components/lightbox-side-arrows";
import { steppedPath } from "@/lib/compare-keys";
import { arrowStep } from "@/lib/social-feed";

interface GalleryLightboxProps {
  /** The photos the Gallery shows, in its sort; the ones without an image in R2 are skipped. */
  files: GalleryFile[];
  /** The path of the photo shown full size, or null while closed. */
  openPath: string | null;
  /** Shows another photo, or closes with null. */
  onOpenPath: (path: string | null) => void;
}

/**
 * The Gallery's photos full size, one at a time: ← and → (or the arrows at the sides) move
 * through every photo the page shows, in its sort and going round, and Esc closes. Closing puts
 * focus back on the tile of the photo last shown.
 */
export function GalleryLightbox({ files, openPath, onOpenPath }: GalleryLightboxProps) {
  const openable = files.filter((file) => fullImageUrl(file));
  const index = openable.findIndex((file) => file.path === openPath);
  const file = openable[index];
  const src = file && fullImageUrl(file);
  if (!file || !src) return null;
  return (
    <OpenLightbox
      paths={openable.map((each) => each.path)}
      index={index}
      file={file}
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
  file: GalleryFile;
  src: string;
  onOpenPath: (path: string | null) => void;
}

function OpenLightbox({ paths, index, file, src, onOpenPath }: OpenLightboxProps) {
  const step = (by: number) => onOpenPath(steppedPath(paths, file.path, by));
  const place = `${index + 1} of ${paths.length}`;
  return (
    <ImageLightbox
      open
      onClose={() => onOpenPath(null)}
      title={file.name}
      src={src}
      description={`${file.name} at full size, photo ${place}. The left and right arrow keys move between the photos.`}
      toolbar={<Toolbar file={file} place={place} />}
      overlay={paths.length > 1 && <LightboxSideArrows onStep={step} />}
      footer={<Footer file={file} />}
      onKeyDown={(event) => stepByKey(event, step)}
      onCloseAutoFocus={(event) => focusLightboxPhoto(event, file.path)}
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

/** The photo's Draft, Undecided or Lower Tier mark, if it has one, and its place among the photos. */
function Toolbar({ file, place }: { file: GalleryFile; place: string }) {
  const mark = file.kind === "published" ? undefined : KIND_MARKS[file.kind];
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
function Footer({ file }: { file: GalleryFile }) {
  return (
    <div className="dark flex flex-wrap items-center justify-center gap-2 p-4 pt-0">
      <EditButton file={file} />
      <span className="text-xs text-white/60">← → to move · Esc to close</span>
    </div>
  );
}
