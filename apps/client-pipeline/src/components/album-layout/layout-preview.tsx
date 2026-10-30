import type { CSSProperties } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { AlbumRow } from "@/api/organize";
import { OfflinePreviewsButton } from "@/components/album-layout/offline-previews";
import { MARKDOWN_CLASSES } from "@/components/photo-details";
import { photoId } from "@/lib/album-photo-order";
import type { AlbumLayout } from "@/lib/album-layout";
import type { CombinedPhoto } from "@/lib/group-photos";
import { offlineXSmallUrl } from "@/lib/offline-thumbnails";

/** Keeps each line break written, as the portfolio shows it. */
const MARKDOWN_PLUGINS = [remarkBreaks];

/** How many of the photos no row has the preview draws before counting the rest. */
const REST_SHOWN = 3;

interface LayoutPreviewProps {
  draft: AlbumLayout;
  /** The album's photos, in its order. */
  photos: CombinedPhoto[];
  byId: ReadonlyMap<number, CombinedPhoto>;
}

/**
 * A small picture of what's in the editor, as the portfolio will show it: the covers strip, then
 * each row's text and photos at their own shapes, then the photos no row has. Photos are drawn
 * from their X-Small versions in the offline copy, so it still works without the internet once
 * they're kept.
 */
export function LayoutPreview({ draft, photos, byId }: LayoutPreviewProps) {
  const placed = new Set(draft.layout.flatMap((row) => row.photos));
  const rest = photos.filter((photo) => !placed.has(photoId(photo) ?? 0));
  return (
    <aside className="bg-muted/20 flex flex-col gap-4 self-start rounded-lg border p-3 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Preview</h3>
        <OfflinePreviewsButton photos={photos} />
      </div>
      <PreviewCovers covers={draft.covers} photos={photos} byId={byId} />
      <div className="bg-background flex flex-col gap-3 rounded-md border p-2">
        {draft.layout.map((row, i) => (
          <PreviewRow key={i} row={row} byId={byId} />
        ))}
        <PreviewRest rest={rest} />
      </div>
    </aside>
  );
}

/** The Albums page's strip: the covers, or else the album's first 5 photos. */
function PreviewCovers({
  covers,
  photos,
  byId,
}: Omit<LayoutPreviewProps, "draft"> & { covers: number[] }) {
  const shown = covers.length > 0 ? photosById(covers, byId) : photos.slice(0, 5);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-xs">On the Albums page</p>
      <div className="flex h-10 gap-1 overflow-hidden">
        {shown.map((photo, i) => (
          <PreviewPhoto key={i} photo={photo} className="h-full" />
        ))}
      </div>
    </div>
  );
}

function PreviewRow({ row, byId }: { row: AlbumRow; byId: ReadonlyMap<number, CombinedPhoto> }) {
  const photos = photosById(row.photos, byId);
  return (
    <div className="flex flex-col gap-1.5">
      <PreviewText text={row.textAbove} />
      {photos.length > 0 && (
        <div className="flex gap-1">
          {photos.map((photo, i) => (
            <PreviewPhoto key={i} photo={photo} grow />
          ))}
        </div>
      )}
      <PreviewText text={row.textBelow} />
    </div>
  );
}

/** A row's Markdown, small; nothing for "". */
function PreviewText({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div
      className={`${MARKDOWN_CLASSES} text-[0.625rem] leading-snug [&_h1]:text-xs [&_h2]:text-xs`}
    >
      <Markdown remarkPlugins={MARKDOWN_PLUGINS}>{text}</Markdown>
    </div>
  );
}

/** The first few photos no row has, one under another, and how many more there are. */
function PreviewRest({ rest }: { rest: CombinedPhoto[] }) {
  if (rest.length === 0) return null;
  const more = rest.length - REST_SHOWN;
  return (
    <div className="flex flex-col items-center gap-1">
      {rest.slice(0, REST_SHOWN).map((photo, i) => (
        <RestPhoto key={i} photo={photo} />
      ))}
      {more > 0 && (
        <p className="text-muted-foreground text-xs">and {more} more, one after another</p>
      )}
    </div>
  );
}

/** The photos with the IDs, in that order, leaving out ones that aren't the album's. */
function photosById(ids: number[], byId: ReadonlyMap<number, CombinedPhoto>): CombinedPhoto[] {
  return ids
    .map((id) => byId.get(id))
    .filter((photo): photo is CombinedPhoto => photo !== undefined);
}

/** A photo no row has, as large as fits the preview's width or 8rem of height, like the page's photos fit the screen. */
function RestPhoto({ photo }: { photo: CombinedPhoto }) {
  return (
    <div style={{ width: `min(100%, ${8 * photoShape(photo)}rem)` }}>
      <PreviewPhoto photo={photo} className="w-full" />
    </div>
  );
}

/** The photo's width over its height, from its JSON, or 3:2 when it doesn't say. */
function photoShape(photo: CombinedPhoto): number {
  const { width, height } = photo as { width?: unknown; height?: unknown };
  const shape = Number(width) / Number(height);
  return Number.isFinite(shape) && shape > 0 ? shape : 1.5;
}

/** A photo's X-Small version at its own shape; with grow, taking its share of a row's width by its shape. */
function PreviewPhoto({
  photo,
  grow,
  className,
}: {
  photo: CombinedPhoto;
  grow?: boolean;
  className?: string;
}) {
  const shape = photoShape(photo);
  const src = offlineXSmallUrl(photo);
  const style: CSSProperties = { aspectRatio: shape, ...(grow ? { flex: `${shape} 1 0%` } : {}) };
  return (
    <div
      className={`bg-muted min-w-0 shrink-0 overflow-hidden rounded-sm ${className ?? ""}`}
      style={style}
    >
      {src && <img src={src} alt="" loading="lazy" className="size-full object-cover" />}
    </div>
  );
}
