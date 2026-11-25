import { Link } from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { PhotoDrawerToggle } from "@/components/instagram-picker/photo-drawer";
import { useBookTemplate, useCaptionFor } from "@/components/photo-book/book-captions";
import { BookTab } from "@/components/photo-book/book-tab";
import { InfoTab } from "@/components/photo-book/info-tab";
import { LayoutsTab } from "@/components/photo-book/layouts-tab";
import { ListTab } from "@/components/photo-book/list-tab";
import type { PageLook } from "@/components/photo-book/page-actions";
import { PagesTab } from "@/components/photo-book/pages-tab";
import { usePhotoBookDraft } from "@/components/photo-book/use-photo-book";
import { SaveState } from "@/components/save-state";
import { type PhotoBook, pageAspect } from "@/lib/photo-book";
import { pageWidthInches } from "@/lib/photo-book-dpi";
import { pageSides } from "@/lib/photo-book-order";
import { cn } from "@/lib/utils";

/**
 * A book's five tabs: Info for its name, album, captions and size; Layouts for trying out page
 * layouts; Photo Pages for making pages that could be used; Book for putting the ones that will be
 * used in order; List for every photo in the book, in order, to jump to editing one.
 */
export type BookPart = "info" | "layouts" | "pages" | "book" | "list";

/** Each tab's name, in the order they're shown. */
export const BOOK_PARTS: Record<BookPart, string> = {
  info: "Info",
  layouts: "Layouts",
  pages: "Photo Pages",
  book: "Book",
  list: "List",
};

/** The tab the URL names; Photo Pages for one the page doesn't know. */
export function bookPart(part: string): BookPart {
  return part in BOOK_PARTS ? (part as BookPart) : "pages";
}

/** What each tab is for, under the tabs. */
const PART_DESCRIPTIONS: Record<BookPart, string> = {
  info: "The book's name, the album its photos come from, the caption template its captions are filled in with, and its page size, which sets the pages' shape.",
  layouts:
    "Try out page layouts at the book's page size before using them: customize a built-in layout to move the captions, size the photos, and change the gaps and margin. The book's layouts show up on Photo Pages.",
  pages:
    "Make pages that could be used, in any layout, from the album's photos, as many as you like. Link a page with the next one to make a two-page spread.",
  book: "Drag pages, spreads and other pages from the drawer into Used page spreads to put the book together, and page through it in the preview.",
  list: "Every photo in the book, page by page in the order it's printed. Edit info opens a photo's editor, to fix its title, Place or anything else its caption shows.",
};

interface BookEditorProps {
  saved: PhotoBook;
  /** Every photo file but the Undecided ones, to find the pages' photos in. */
  photos: SocialPhoto[];
  data: CombinedData;
  part: BookPart;
  /** Called once the book is removed. */
  onRemoved: () => void;
}

/** Everything a tab gets from the editor. */
interface TabProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  look: PageLook;
  data: CombinedData;
  photos: SocialPhoto[];
  templates: ReturnType<typeof useBookTemplate>["templates"];
  template: ReturnType<typeof useBookTemplate>["template"];
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  onRemoved: () => void;
}

/** How each tab is drawn. */
const TABS: Record<BookPart, (props: TabProps) => ReactNode> = {
  info: (p) => <InfoTab {...p} />,
  layouts: (p) => <LayoutsTab {...p} />,
  pages: (p) => (
    <PagesTab {...p} drawer={p.drawerOpen ? () => p.setDrawerOpen(false) : undefined} />
  ),
  book: (p) => <BookTab {...p} />,
  list: (p) => <ListTab {...p} />,
};

/** The open book: its tabs, what the open one is for, and the open one. */
export function BookEditor({ saved, photos, data, part, onRemoved }: BookEditorProps) {
  const { book, update, error, saving } = usePhotoBookDraft(saved);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const byPath = useMemo(() => new Map(photos.map((p) => [p.path, p])), [photos]);
  const { templates, template } = useBookTemplate(book);
  const look: PageLook = {
    photos: byPath,
    captionFor: useCaptionFor(byPath, template),
    aspect: pageAspect(book),
    layouts: book.layouts ?? [],
    sides: pageSides(book),
    printWidth: pageWidthInches(book),
  };
  const drawer = part === "pages" && (
    <PhotoDrawerToggle open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PartTabs id={book.id} part={part} />
          <div className="flex items-center gap-2">
            <SaveState saving={saving} error={error} />
            {drawer}
          </div>
        </div>
        <p className="text-muted-foreground text-sm">{PART_DESCRIPTIONS[part]}</p>
      </div>
      {TABS[part]({
        book,
        update,
        look,
        data,
        photos,
        templates,
        template,
        drawerOpen,
        setDrawerOpen,
        onRemoved,
      })}
    </div>
  );
}

/** The book's tabs, each a link. */
function PartTabs({ id, part }: { id: string; part: BookPart }) {
  return (
    <nav
      aria-label="This book's tabs"
      className="bg-muted text-muted-foreground inline-flex w-fit items-center rounded-lg p-1"
    >
      {(Object.keys(BOOK_PARTS) as BookPart[]).map((p) => (
        <Link
          key={p}
          to="/photo-books/$id/$part"
          params={{ id, part: p }}
          aria-current={p === part ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium",
            p === part && "bg-background text-foreground shadow-sm",
          )}
        >
          {BOOK_PARTS[p]}
        </Link>
      ))}
    </nav>
  );
}
