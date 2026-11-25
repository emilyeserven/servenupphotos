import { HeadingIcon, Link2Icon, Trash2Icon, Unlink2Icon } from "lucide-react";
import { MoveArrows } from "@/components/move-arrows";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { pageName } from "@/components/photo-book/page-types";
import { Button } from "@/components/ui/button";
import type { BookPage, PageLayout } from "@/lib/photo-book";
import type { LayoutChoice } from "@/lib/photo-book-layouts";

interface PageControlsProps {
  page: BookPage;
  /** The layouts the page can have: the built-in ones and the book's own. */
  layouts: LayoutChoice[];
  onName: (name: string) => void;
  onLayout: (layout: PageLayout) => void;
  onTitle: (title: string | null) => void;
  onRemove: () => void;
}

/**
 * Above a page on the Photo Pages tab: its name, typed in, its layout, a title to add or take off,
 * and Remove.
 */
export function PageControls(props: PageControlsProps) {
  const { page, layouts, onName, onLayout, onTitle, onRemove } = props;
  const name = pageName(page);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input
        aria-label="Page name"
        value={page.name ?? ""}
        placeholder="Name this page"
        onChange={(event) => onName(event.target.value)}
        className="hover:border-input focus:border-input placeholder:text-muted-foreground mr-1 h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm font-medium outline-none"
      />
      <LayoutButtons page={page} name={name} layouts={layouts} onLayout={onLayout} />
      <TitleButton page={page} name={name} onTitle={onTitle} />
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Remove ${name}`}
        title="Remove page"
        onClick={onRemove}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}

interface UnitControlsProps {
  /** What the unit is called on its buttons: its page's name, or its two pages' names. */
  name: string;
  spread: boolean;
  inBook: boolean;
  /** Whether the page can be linked with the next one: there's a next one, on its own. */
  canLink: boolean;
  /** The unit's place among the photo pages, 0 first. */
  place: number;
  last: boolean;
  onLink: (link: boolean) => void;
  onMove: (from: number, to: number) => void;
}

/**
 * Above a page or spread on the Photo Pages tab: whether it's in the book, a button that links the
 * page with the next one into a spread or unlinks the spread, and arrows that move it.
 */
export function UnitControls(props: UnitControlsProps) {
  const { name, spread, inBook, canLink, place, last, onLink, onMove } = props;
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
      <UnitLabels spread={spread} inBook={inBook} />
      <span className="ml-auto flex items-center gap-1">
        {canLink || spread ? <LinkButton spread={spread} name={name} onLink={onLink} /> : null}
        <MoveArrows name={name} place={place} last={last} onMove={onMove} />
      </span>
    </div>
  );
}

/** "Two-page spread" on a spread, and "In book" on one in the book. */
function UnitLabels({ spread, inBook }: { spread: boolean; inBook: boolean }) {
  return (
    <>
      {spread && <span className="font-medium">Two-page spread</span>}
      {inBook && <InBookBadge />}
    </>
  );
}

/** **Link with next page**, or **Unlink** on a spread. */
function LinkButton(props: { spread: boolean; name: string; onLink: (link: boolean) => void }) {
  const { spread, name, onLink } = props;
  const Icon = spread ? Unlink2Icon : Link2Icon;
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={spread ? `Unlink ${name}` : `Link ${name} with the next page`}
      onClick={() => onLink(!spread)}
    >
      <Icon />
      {spread ? "Unlink" : "Link with next page"}
    </Button>
  );
}

interface ButtonProps {
  page: BookPage;
  /** How the button names the page, its name. */
  name: string;
}

/** A button for each layout, the page's own pressed, to switch it. */
function LayoutButtons({
  page,
  name,
  layouts,
  onLayout,
}: ButtonProps & { layouts: LayoutChoice[]; onLayout: (layout: PageLayout) => void }) {
  return (
    <div role="radiogroup" aria-label={`Layout of ${name}`} className="flex gap-0.5">
      {layouts.map((layout) => (
        <Button
          key={layout.id}
          size="icon-xs"
          variant={page.layout === layout.id ? "secondary" : "ghost"}
          role="radio"
          aria-checked={page.layout === layout.id}
          aria-label={layout.label}
          title={layout.label}
          onClick={() => onLayout(layout.id)}
        >
          <LayoutGlyph layout={layout.id} look={layout.look} className="h-3.5 w-4.5" />
        </Button>
      ))}
    </div>
  );
}

/** **H**: adds a title to the page, or takes it off. */
function TitleButton({
  page,
  name,
  onTitle,
}: ButtonProps & { onTitle: (title: string | null) => void }) {
  const none = page.title === null;
  return (
    <Button
      size="icon-xs"
      variant={none ? "ghost" : "secondary"}
      aria-pressed={!none}
      aria-label={none ? `Add a title to ${name}` : `Take the title off ${name}`}
      title={none ? "Add a title" : "Take the title off"}
      onClick={() => onTitle(none ? "" : null)}
    >
      <HeadingIcon />
    </Button>
  );
}

/** "In book", on a page or spread that's in the book. */
export function InBookBadge() {
  return (
    <span className="bg-secondary text-secondary-foreground rounded-md px-1.5 py-0.5 text-xs font-medium">
      In book
    </span>
  );
}
