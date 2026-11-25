import { CopyPlusIcon, ShuffleIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { useAlbumPhotos } from "@/components/photo-book/album-photos";
import { LayoutFields } from "@/components/photo-book/layout-fields";
import { LayoutList } from "@/components/photo-book/layout-list";
import type { PageLook } from "@/components/photo-book/page-actions";
import { UnitSheets } from "@/components/photo-book/unit-sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type BookPage, type PageLayout, type PhotoBook, layoutSlots } from "@/lib/photo-book";
import {
  addLayout,
  changeLayout,
  customLayout,
  layoutChoices,
  pagesUsing,
  removeLayout,
} from "@/lib/photo-book-layouts";
import { askFirst } from "@/stores/confirm";
import { count } from "@portfolio/lib/words";

interface LayoutsTabProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  look: PageLook;
  data: CombinedData;
  /** Every photo file but the Undecided ones. */
  photos: SocialPhoto[];
}

/**
 * A book's Layouts tab: the built-in layouts and the book's own on the left, and the one picked,
 * drawn as a page of the book's shape with the album's photos, beside its settings. Customize makes
 * a new layout from any of them, to try out where the captions go and how big the photos are
 * before using it on Photo Pages.
 */
export function LayoutsTab({ book, update, look, data, photos }: LayoutsTabProps) {
  const [selected, setSelected] = useState<PageLayout>(book.layouts?.[0]?.id ?? "full");
  const [offset, setOffset] = useState(0);
  const albumPhotos = useAlbumPhotos(data, photos, book.album);
  const customize = (from: PageLayout) => {
    const name = `${layoutChoices(book).find((c) => c.id === from)?.label ?? "Layout"} (mine)`;
    const added = addLayout(book, from, name);
    update(added.book);
    setSelected(added.id);
  };
  const sample = samplePage(book, selected, albumPhotos, offset);
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
        <LayoutList
          book={book}
          selected={selected}
          onSelect={setSelected}
          onCustomize={customize}
        />
        <section aria-label="Layout settings" className="flex flex-col gap-4 border-t pt-4">
          <LayoutSettings
            book={book}
            layout={selected}
            update={update}
            onCustomize={() => customize(selected)}
            onRemoved={() => setSelected("full")}
          />
        </section>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:sticky lg:top-4">
        <div className="mx-auto w-full" style={{ maxWidth: `calc(${look.aspect} * 75vh)` }}>
          <UnitSheets pages={[sample]} look={look} />
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={albumPhotos.length <= sample.slots.length}
            onClick={() => setOffset(offset + sample.slots.length)}
          >
            <ShuffleIcon />
            Other photos
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * A page in layout to preview it, with the album's photos from offset on, their captions from the
 * caption template, and a title.
 */
function samplePage(
  book: PhotoBook,
  layout: PageLayout,
  photos: SocialPhoto[],
  offset: number,
): BookPage {
  const n = layoutSlots(book, layout);
  const start = photos.length > n ? offset % photos.length : 0;
  const picked = [...photos.slice(start), ...photos].slice(0, n);
  return {
    id: "layout-preview",
    name: "Preview",
    layout,
    title: "Title",
    slots: Array.from({ length: n }, (_, i) => ({ photo: picked[i]?.path ?? "", caption: null })),
  };
}

interface LayoutSettingsProps {
  book: PhotoBook;
  layout: PageLayout;
  update: (book: PhotoBook) => void;
  onCustomize: () => void;
  onRemoved: () => void;
}

/**
 * The picked layout's settings: a built-in one's description and Customize, or one of the book's
 * own layouts' name, every setting, and Remove layout.
 */
function LayoutSettings({ book, layout, update, onCustomize, onRemoved }: LayoutSettingsProps) {
  const custom = customLayout(book, layout);
  if (!custom) {
    const choice = layoutChoices(book).find((c) => c.id === layout);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{choice?.label}</p>
        <p className="text-muted-foreground text-sm">{choice?.description}</p>
        <p className="text-muted-foreground text-sm">
          Built-in layouts stay as they are. Customize makes a layout of this book&apos;s own from
          this one&apos;s settings, to change.
        </p>
        <div>
          <Button size="sm" onClick={onCustomize}>
            <CopyPlusIcon />
            Customize
          </Button>
        </div>
      </div>
    );
  }
  const remove = async () => {
    const used = pagesUsing(book, custom.id);
    const yes =
      used === 0 ||
      (await askFirst({
        question: `Remove the layout “${custom.name}”?`,
        note: `It's on ${count(used, "page")}, which will become full pages.`,
        action: "Remove layout",
      }));
    if (!yes) return;
    update(removeLayout(book, custom.id));
    onRemoved();
  };
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <Input
          value={custom.name}
          onChange={(event) => update(changeLayout(book, custom.id, { name: event.target.value }))}
        />
      </label>
      <LayoutFields
        look={custom}
        onChange={(change) => update(changeLayout(book, custom.id, change))}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onCustomize}>
          <CopyPlusIcon />
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void remove()}>
          <Trash2Icon />
          Remove layout
        </Button>
      </div>
    </div>
  );
}
