import { CopyPlusIcon, ShuffleIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { useAlbumPhotos } from "@/components/photo-book/album-photos";
import { LayoutFields } from "@/components/photo-book/layout-fields";
import { LayoutList } from "@/components/photo-book/layout-list";
import { LeftPagesField } from "@/components/photo-book/left-pages-field";
import type { PageLook } from "@/components/photo-book/page-actions";
import { PrintGuidesToggle, PrintPreviewToggle } from "@/components/photo-book/print-guides";
import {
  HideEverywhereField,
  SaveStandardButton,
  type StandardProps,
  StandardList,
  StandardSettings,
  standardIdOf,
  useStandardLayouts,
} from "@/components/photo-book/standard-layouts";
import { UnitSheets } from "@/components/photo-book/unit-sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type BookPage,
  type BuiltInLayout,
  type CustomLayout,
  type PageLayout,
  type PageSide,
  type PhotoBook,
} from "@/lib/photo-book";
import {
  addLayout,
  changeLayout,
  changeSide,
  customLayout,
  everyLayoutChoice,
  pagesUsing,
  removeLayout,
  setHidden,
  setLeftPages,
  sideLook,
} from "@/lib/photo-book-layouts";
import { frameFits, photoAspect, pickForFrames } from "@/lib/photo-book-preview";
import { type StandardLayouts, addStandard } from "@/lib/photo-book-standard";
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
  const standard = useStandardLayouts(data);
  const std: StandardProps = { ...standard, updateFile: standard.update };
  const { selected, setSelected, customize, addFromStandard } = useLayoutPicks(
    book,
    update,
    standard.file,
  );
  const preview = previewOf(book, standard.file, selected);
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
        <LayoutList
          book={book}
          selected={selected}
          onSelect={setSelected}
          onCustomize={customize}
          onHide={(id, hide) => update(setHidden(book, id, hide))}
          hiddenEverywhere={standard.file.hiddenLayouts ?? []}
          standard={
            <StandardList
              book={book}
              file={standard.file}
              selected={selected}
              onSelect={setSelected}
              onAdd={addFromStandard}
            />
          }
        />
        <section aria-label="Layout settings" className="flex flex-col gap-4 border-t pt-4">
          <LayoutSettings
            book={book}
            layout={selected}
            update={update}
            std={std}
            onCustomize={() => customize(selected as PageLayout)}
            onAddStandard={addFromStandard}
            onSelect={setSelected}
          />
        </section>
      </div>
      <PreviewColumn {...preview} look={look} data={data} photos={photos} />
    </div>
  );
}

/**
 * The Layouts tab's selection and what picks a new one: Customize, which makes a layout of the
 * book's own from another, and adding a standard layout to the book.
 */
function useLayoutPicks(book: PhotoBook, update: (book: PhotoBook) => void, file: StandardLayouts) {
  const [selected, setSelected] = useState<string>(book.layouts?.[0]?.id ?? "full");
  const customize = (from: PageLayout) => {
    const name = `${everyLayoutChoice(book).find((c) => c.id === from)?.label ?? "Layout"} (mine)`;
    const added = addLayout(book, from, name);
    update(added.book);
    setSelected(added.id);
  };
  const addFromStandard = (id: string) => {
    const added = addStandard(book, file, id);
    if (!added.id) return;
    update(added.book);
    setSelected(added.id);
  };
  return { selected, setSelected, customize, addFromStandard };
}

/**
 * The picked layout drawn as the book's pages with the album's photos, with the preview toggles
 * and Other photos under it.
 */
function PreviewColumn(props: {
  book: PhotoBook;
  layout: PageLayout;
  look: PageLook;
  data: CombinedData;
  photos: SocialPhoto[];
}) {
  const { book, layout, look, data, photos } = props;
  const [offset, setOffset] = useState(0);
  const albumPhotos = useAlbumPhotos(data, photos, book.album);
  const pages = previewPages(book, layout, albumPhotos, offset);
  const shown = pages.reduce((n, page) => n + page.slots.length, 0);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 lg:sticky lg:top-4">
      <PreviewSheets pages={pages} look={{ ...look, layouts: book.layouts ?? [] }} />
      <div className="flex flex-wrap items-center justify-center gap-4">
        <PrintPreviewToggle />
        <PrintGuidesToggle />
        <Button
          size="sm"
          variant="outline"
          disabled={albumPhotos.length <= shown}
          onClick={() => setOffset(offset + shown)}
        >
          <ShuffleIcon />
          Other photos
        </Button>
      </div>
    </div>
  );
}

/**
 * The preview's pages and how they're drawn: one of the book's own layouts as a left and a right
 * page side by side, labeled, and a built-in one as one page.
 */
function PreviewSheets({ pages, look }: { pages: BookPage[]; look: PageLook }) {
  const width = look.aspect * pages.length;
  return (
    <div
      className="mx-auto flex w-full flex-col gap-1"
      style={{ maxWidth: `calc(${width} * 75vh)` }}
    >
      <UnitSheets pages={pages} look={look} className="gap-px" />
      {pages.length > 1 && (
        <div className="text-muted-foreground grid grid-cols-2 text-center text-xs">
          <span>Left page (even)</span>
          <span>Right page (odd)</span>
        </div>
      )}
    </div>
  );
}

/**
 * The book and layout to preview for the Layouts tab's selection: the book with a copy of a picked
 * standard layout added, or the book as it is.
 */
function previewOf(
  book: PhotoBook,
  file: StandardLayouts,
  selected: string,
): { book: PhotoBook; layout: PageLayout } {
  const id = standardIdOf(selected);
  if (id === undefined) return { book, layout: selected as PageLayout };
  const added = addStandard(book, file, id);
  return { book: added.book, layout: added.id ?? "full" };
}

/**
 * The pages to preview layout on: a left and a right one for the book's own, else one, each frame
 * with an album photo of its shape where there is one.
 */
function previewPages(
  book: PhotoBook,
  layout: PageLayout,
  photos: SocialPhoto[],
  offset: number,
): BookPage[] {
  const used = new Set<SocialPhoto>();
  const page = (id: string, side: PageSide) =>
    samplePage(
      layout,
      pickForFrames(photos, frameFits(book, layout, side), offset, photoOf, used),
      id,
    );
  if (!customLayout(book, layout)) return [page("layout-preview", "right")];
  return [page("layout-preview", "left"), page("layout-preview-right", "right")];
}

/** A photo's width over its height, from its file's data. */
function photoOf(photo: SocialPhoto): number | null {
  return photoAspect(photo.data);
}

/** A page in layout to preview it, with picked photos, their captions from the caption template, and a title. */
function samplePage(layout: PageLayout, picked: (SocialPhoto | undefined)[], id: string): BookPage {
  return {
    id,
    name: "Preview",
    layout,
    title: "Title",
    slots: picked.map((photo) => ({ photo: photo?.path ?? "", caption: null })),
  };
}

interface LayoutSettingsProps {
  book: PhotoBook;
  /** The Layouts tab's selection: a layout's ID, or a standard layout's key. */
  layout: string;
  update: (book: PhotoBook) => void;
  std: StandardProps;
  onCustomize: () => void;
  onAddStandard: (id: string) => void;
  onSelect: (key: string) => void;
}

/**
 * The picked layout's settings: a standard layout's (see StandardSettings), a built-in one's
 * description, Customize and Hide in every book, or one of the book's own layouts' name, every
 * setting, Save as standard layout and Remove layout.
 */
function LayoutSettings(props: LayoutSettingsProps) {
  const { book, layout, update, std, onCustomize, onAddStandard, onSelect } = props;
  const standardId = standardIdOf(layout);
  if (standardId !== undefined) {
    return (
      <StandardSettings
        {...std}
        book={book}
        id={standardId}
        onAdd={() => onAddStandard(standardId)}
        onOpenCopy={onSelect}
        onRemoved={() => onSelect("full")}
      />
    );
  }
  const custom = customLayout(book, layout);
  if (!custom) {
    return <BuiltInSettings book={book} layout={layout} std={std} onCustomize={onCustomize} />;
  }
  return (
    <OwnSettings
      book={book}
      custom={custom}
      update={update}
      std={std}
      onCustomize={onCustomize}
      onRemoved={() => onSelect("full")}
    />
  );
}

/** A built-in layout's description, Customize and Hide in every book. */
function BuiltInSettings(
  props: Pick<LayoutSettingsProps, "book" | "layout" | "std" | "onCustomize">,
) {
  const { book, layout, std, onCustomize } = props;
  const choice = everyLayoutChoice(book).find((c) => c.id === layout);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{choice?.label}</p>
      <p className="text-muted-foreground text-sm">{choice?.description}</p>
      <p className="text-muted-foreground text-sm">
        Built-in layouts stay as they are. Customize makes a layout of this book&apos;s own from
        this one&apos;s settings, to change. The eye beside a built-in layout hides it from the
        Photo Pages&apos; layout buttons, so the book&apos;s own are used instead.
      </p>
      <div>
        <Button size="sm" onClick={onCustomize}>
          <CopyPlusIcon />
          Customize
        </Button>
      </div>
      <HideEverywhereField {...std} id={layout as BuiltInLayout} />
    </div>
  );
}

/** One of the book's own layouts' settings, Save as standard layout, Copy and Remove layout. */
function OwnSettings(
  props: Pick<LayoutSettingsProps, "book" | "update" | "std" | "onCustomize"> & {
    custom: CustomLayout;
    onRemoved: () => void;
  },
) {
  const { book, custom, update, std, onCustomize, onRemoved } = props;
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
      <CustomFields book={book} custom={custom} update={update} />
      <SaveStandardButton {...std} book={book} custom={custom} update={update} />
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

/**
 * One of the book's own layouts' name, how it draws left-hand pages, and every setting of the side
 * picked.
 */
function CustomFields(props: {
  book: PhotoBook;
  custom: CustomLayout;
  update: (book: PhotoBook) => void;
}) {
  const { book, custom, update } = props;
  const [picked, setPicked] = useState<PageSide>("right");
  const editing = custom.leftPages === "own" ? picked : "right";
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Name
        <Input
          value={custom.name}
          onChange={(event) => update(changeLayout(book, custom.id, { name: event.target.value }))}
        />
      </label>
      <LeftPagesField
        layout={custom}
        onLeftPages={(what) => update(setLeftPages(book, custom.id, what))}
        editing={editing}
        onEditing={setPicked}
      />
      <LayoutFields
        look={sideLook(custom, editing)}
        onChange={(change) => update(changeSide(book, custom.id, editing, change))}
      />
    </>
  );
}
