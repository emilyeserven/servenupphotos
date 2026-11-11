import { HeadingIcon, Trash2Icon } from "lucide-react";
import type { SocialPhoto } from "@/api/publish";
import { MoveArrows } from "@/components/move-arrows";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { PhotoSlot, SlotCaption } from "@/components/photo-book/page-slot";
import { Button } from "@/components/ui/button";
import { type BookPage as Page, LAYOUTS, type PageLayout } from "@/lib/photo-book";
import { cn } from "@/lib/utils";

/** What a page can do to the book it's in. */
export interface PageActions {
  onLayout: (layout: PageLayout) => void;
  onTitle: (title: string | null) => void;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  onDropPhoto: (slot: number, path: string) => void;
  onRemovePhoto: (path: string) => void;
  onCaption: (slot: number, caption: string | null) => void;
}

interface BookPageProps {
  page: Page;
  /** The page's place in the book, 0 first. */
  index: number;
  last: boolean;
  photos: Map<string, SocialPhoto>;
  captionFor: (slot: Page["slots"][number]) => string;
  actions: PageActions;
}

/** One page of the book: its controls above it, and the page itself in its layout. */
export function BookPage({ page, index, last, photos, captionFor, actions }: BookPageProps) {
  return (
    <section aria-label={`Page ${index + 1}`} className="flex flex-col gap-2">
      <PageControls page={page} index={index} last={last} actions={actions} />
      <div className="aspect-[4/5] rounded-sm border bg-white p-[6%] text-neutral-900 shadow-sm dark:bg-neutral-100">
        <div className="flex size-full flex-col gap-[4%]">
          {page.title !== null && (
            <input
              aria-label={`Page ${index + 1} title`}
              value={page.title}
              placeholder="Page title"
              onChange={(event) => actions.onTitle(event.target.value)}
              className="w-full shrink-0 rounded-sm bg-transparent text-center font-serif text-base font-semibold outline-none placeholder:text-neutral-400 hover:bg-neutral-200/60 focus:bg-neutral-200/60"
            />
          )}
          <PageBody page={page} photos={photos} captionFor={captionFor} actions={actions} />
        </div>
      </div>
    </section>
  );
}

type BodyProps = Pick<BookPageProps, "page" | "photos" | "captionFor" | "actions">;

/** The page's photos and captions, laid out as its layout says. */
function PageBody({ page, photos, captionFor, actions }: BodyProps) {
  const slot = (i: number, className?: string) => {
    const s = page.slots[i];
    if (!s) return null;
    return (
      <PhotoSlot
        key={`photo-${i}`}
        slot={s}
        photo={photos.get(s.photo)}
        onDrop={(path) => actions.onDropPhoto(i, path)}
        onRemove={() => actions.onRemovePhoto(s.photo)}
        className={className}
      />
    );
  };
  const caption = (i: number, className?: string) => {
    const s = page.slots[i];
    if (!s) return null;
    return (
      <SlotCaption
        key={`caption-${i}`}
        slot={s}
        text={captionFor(s)}
        onChange={(text) => actions.onCaption(i, text)}
        className={className}
      />
    );
  };
  if (page.layout === "full") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-[3%]">
        {slot(0, "flex-1")}
        {caption(0, "h-[18%] shrink-0 text-center")}
      </div>
    );
  }
  const photosFirst = page.layout === "pair-left";
  return (
    <div className="grid min-h-0 flex-1 grid-rows-2 gap-[4%]">
      {[0, 1].map((i) => (
        <div
          key={i}
          className={cn(
            "grid min-h-0 gap-[4%]",
            photosFirst ? "grid-cols-[3fr_2fr]" : "grid-cols-[2fr_3fr]",
          )}
        >
          {photosFirst ? [slot(i), caption(i)] : [caption(i, "text-right"), slot(i)]}
        </div>
      ))}
    </div>
  );
}

interface PageControlsProps {
  page: Page;
  index: number;
  last: boolean;
  actions: PageActions;
}

/** The page's number, its layout, a title to add or take off, arrows to move it, and Remove. */
function PageControls({ page, index, last, actions }: PageControlsProps) {
  const name = `page ${index + 1}`;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-sm font-medium">Page {index + 1}</span>
      <div role="radiogroup" aria-label={`Layout of ${name}`} className="flex gap-0.5">
        {LAYOUTS.map((layout) => (
          <Button
            key={layout.id}
            size="icon-xs"
            variant={page.layout === layout.id ? "secondary" : "ghost"}
            role="radio"
            aria-checked={page.layout === layout.id}
            aria-label={layout.label}
            title={layout.label}
            onClick={() => actions.onLayout(layout.id)}
          >
            <LayoutGlyph layout={layout.id} className="h-4 w-3.5" />
          </Button>
        ))}
      </div>
      <Button
        size="icon-xs"
        variant={page.title === null ? "ghost" : "secondary"}
        aria-pressed={page.title !== null}
        aria-label={page.title === null ? `Add a title to ${name}` : `Take the title off ${name}`}
        title={page.title === null ? "Add a title" : "Take the title off"}
        onClick={() => actions.onTitle(page.title === null ? "" : null)}
      >
        <HeadingIcon />
      </Button>
      <span className="ml-auto flex items-center">
        <MoveArrows name={name} place={index} last={last} onMove={actions.onMove} />
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Remove ${name}`}
          title="Remove page"
          onClick={actions.onRemove}
        >
          <Trash2Icon />
        </Button>
      </span>
    </div>
  );
}
