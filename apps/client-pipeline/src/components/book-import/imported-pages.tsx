import type { SocialPhoto } from "@/api/publish";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { SectionTitle } from "@/components/section-title";
import type { ImportedPage, ImportedSlot } from "@/lib/book-import";
import { LAYOUTS } from "@/lib/photo-book";

interface ImportedPagesProps {
  pages: ImportedPage[];
  /** Every photo file, by its path. */
  photos: ReadonlyMap<string, SocialPhoto>;
}

/** The book's pages as they'll be made: each one's layout, title and photos, an empty place for a photo not on the website. */
export function ImportedPages({ pages, photos }: ImportedPagesProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionTitle>Pages</SectionTitle>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((page, i) => (
          <li key={i} className="bg-background flex flex-col gap-2 rounded-md border p-2">
            <div className="flex items-center gap-2 text-xs">
              <LayoutGlyph layout={page.layout} className="h-3 w-4" />
              <span className="font-medium">
                {page.printed === null ? `Page ${i + 1}` : `Page ${page.printed}`}
              </span>
              <span className="text-muted-foreground truncate">
                {LAYOUTS.find((l) => l.id === page.layout)?.label}
                {page.title && ` · ${page.title}`}
              </span>
            </div>
            <div className="flex gap-2">
              {page.slots.map((slot, s) => (
                <ImportedPlace key={s} slot={slot} photo={photos.get(slot.photo)} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One photo place: the matched photo's thumbnail, or the printed title of one not on the website. */
function ImportedPlace({ slot, photo }: { slot: ImportedSlot; photo: SocialPhoto | undefined }) {
  const label = photo?.title || slot.printedTitle;
  return (
    <figure className="flex w-24 min-w-0 flex-col gap-1 text-xs">
      <PlaceImage photo={photo} label={label} />
      <figcaption className="truncate" title={label}>
        {label}
      </figcaption>
    </figure>
  );
}

/** The matched photo's thumbnail, or a dashed box saying the photo isn't on the website. */
function PlaceImage({ photo, label }: { photo: SocialPhoto | undefined; label: string }) {
  if (!photo) {
    return (
      <div className="text-muted-foreground flex aspect-square w-full items-center justify-center rounded-md border border-dashed p-1 text-center">
        Not on the website
      </div>
    );
  }
  return <PickedThumbnail data={photo.data} alt={label || photo.path} className="w-full" />;
}
