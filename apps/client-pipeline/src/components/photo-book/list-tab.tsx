import { Link } from "@tanstack/react-router";
import { ImageIcon, PencilIcon } from "lucide-react";
import type { SocialPhoto } from "@/api/publish";
import type { PageLook } from "@/components/photo-book/page-actions";
import { pageName } from "@/components/photo-book/page-types";
import { SectionTitle } from "@/components/section-title";
import { type BookSlot, type PhotoBook, isOtherPage } from "@/lib/photo-book";
import { layoutName } from "@/lib/photo-book-layouts";
import { type ListedPage, listedPages, photoCount } from "@/lib/photo-book-list";
import { unitsInBook } from "@/lib/photo-book-order";
import { photoName } from "@/lib/social-schedule";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/**
 * A book's List tab: every page in the book, in the order it's printed, numbered, with each of its
 * photos in its layout's order and a link that opens the photo's editor, to fix its title, Place or
 * anything else its caption shows.
 */
export function ListTab({ book, look }: { book: PhotoBook; look: PageLook }) {
  const pages = listedPages(unitsInBook(book));
  if (pages.length === 0) {
    return (
      <EmptyNote>
        No pages in the book yet. Put pages and spreads in the book on the Book tab.
      </EmptyNote>
    );
  }
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        {count(photoCount(pages), "photo")} on {count(pages.length, "page")}
      </p>
      {pages.map((listed) => (
        <ListedPageRows key={listed.page.id} book={book} look={look} listed={listed} />
      ))}
    </div>
  );
}

/** One page: its number, name and layout, then its photos, or a note for an other page. */
function ListedPageRows(props: { book: PhotoBook; look: PageLook; listed: ListedPage }) {
  const { book, look, listed } = props;
  const { number, page } = listed;
  const other = isOtherPage(page);
  return (
    <section aria-label={`Page ${number}`} className="flex flex-col gap-2">
      <SectionTitle as="h2">
        Page {number} · {pageName(page)}
        <span className="text-muted-foreground ml-2 text-xs font-normal">
          {other ? "Other page" : layoutName(book, page.layout)}
        </span>
      </SectionTitle>
      {other ? (
        <EmptyNote>No photos on this page.</EmptyNote>
      ) : (
        <ol className="flex flex-col divide-y rounded-md border">
          {page.slots.map((slot, i) => (
            <PhotoRow key={i} at={i} slot={slot} look={look} />
          ))}
        </ol>
      )}
    </section>
  );
}

/** One photo place: its Square Thumbnail, name and caption's first line, and a link to edit it. */
function PhotoRow(props: { at: number; slot: BookSlot; look: PageLook }) {
  const { at, slot, look } = props;
  const photo = look.photos.get(slot.photo);
  return (
    <li className="flex items-center gap-3 p-2">
      <span className="text-muted-foreground w-4 shrink-0 text-right text-xs">{at + 1}</span>
      <Thumbnail photo={photo} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PhotoWords slot={slot} photo={photo} caption={look.captionFor(slot)} />
      </div>
      {slot.photo !== "" && (
        <Link
          to="/exif"
          search={{ edit: slot.photo }}
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-sm"
        >
          <PencilIcon className="size-3.5" />
          Edit info
        </Link>
      )}
    </li>
  );
}

/** The photo's name and its caption's first line; what's wrong when there's no photo to show. */
function PhotoWords(props: { slot: BookSlot; photo: SocialPhoto | undefined; caption: string }) {
  const { slot, photo, caption } = props;
  if (slot.photo === "") return <span className="text-muted-foreground text-sm">Empty place</span>;
  if (!photo) {
    return (
      <span className="text-muted-foreground text-sm">
        This photo isn&apos;t in the photo files any more
      </span>
    );
  }
  const [title = ""] = caption.split("\n");
  return (
    <>
      <span className="truncate text-sm font-medium">{photoName(photo)}</span>
      <span className="text-muted-foreground truncate text-xs" title={caption}>
        {title || "No caption"}
      </span>
    </>
  );
}

/** The photo's Square Thumbnail, or an icon when it has none. */
function Thumbnail({ photo }: { photo: SocialPhoto | undefined }) {
  if (!photo?.image) {
    return (
      <span className="bg-muted flex size-12 shrink-0 items-center justify-center rounded">
        <ImageIcon className="text-muted-foreground size-4" />
      </span>
    );
  }
  return (
    <img
      src={photo.image}
      alt=""
      loading="lazy"
      className="size-12 shrink-0 rounded object-cover"
    />
  );
}
