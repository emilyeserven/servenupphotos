import { BookMinusIcon, BookPlusIcon, HeadingIcon, Trash2Icon } from "lucide-react";
import { MoveArrows } from "@/components/move-arrows";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { pageName } from "@/components/photo-book/page-types";
import { Button } from "@/components/ui/button";
import { type BookPage, LAYOUTS, type PageLayout } from "@/lib/photo-book";
import { cn } from "@/lib/utils";

/** The page's name above it: its number in the book, or that it isn't in the book. */
function PageLabel({ number }: { number: number | null }) {
  return (
    <span className={cn("mr-1 text-sm font-medium", number === null && "text-muted-foreground")}>
      {pageName(number)}
    </span>
  );
}

/** How the page's buttons name it, such as "page 3", or "page idea 4" for one not in the book. */
function buttonName(index: number, number: number | null): string {
  return number === null ? `page idea ${index + 1}` : `page ${number}`;
}

interface WorkshopControlsProps {
  page: BookPage;
  index: number;
  number: number | null;
  onLayout: (layout: PageLayout) => void;
  onTitle: (title: string | null) => void;
  /** Adds the page to the end of the book, or takes it out when inBook is false. */
  onBook: (inBook: boolean) => void;
  onRemove: () => void;
}

/**
 * Above a page on the Pages tab: whether it's in the book, its layout, a title to add or take off,
 * a button that adds it to the book or takes it out, and Remove.
 */
export function WorkshopControls(props: WorkshopControlsProps) {
  const { page, index, number, onLayout, onTitle, onBook, onRemove } = props;
  const name = buttonName(index, number);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <PageLabel number={number} />
      <LayoutButtons page={page} name={name} onLayout={onLayout} />
      <TitleButton page={page} name={name} onTitle={onTitle} />
      <span className="ml-auto flex items-center gap-1">
        <BookButton inBook={number !== null} name={name} onBook={onBook} />
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Remove ${name}`}
          title="Remove page"
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </span>
    </div>
  );
}

interface OrderControlsProps {
  /** The page's number in the book. */
  number: number;
  last: boolean;
  /** Moves the page from one place in the book to another, 0 first. */
  onMove: (from: number, to: number) => void;
  onTakeOut: () => void;
}

/** Above a page on the Book tab: its number, arrows that move it, and a button that takes it out. */
export function OrderControls({ number, last, onMove, onTakeOut }: OrderControlsProps) {
  const name = `page ${number}`;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <PageLabel number={number} />
      <span className="ml-auto flex items-center gap-1">
        <MoveArrows name={name} place={number - 1} last={last} onMove={onMove} />
        <BookButton inBook name={name} onBook={() => onTakeOut()} />
      </span>
    </div>
  );
}

/** Above a page on the Book tab that isn't in the book yet: a button that adds it at the end. */
export function SpareControls({ index, onAdd }: { index: number; onAdd: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <PageLabel number={null} />
      <span className="ml-auto">
        <BookButton inBook={false} name={buttonName(index, null)} onBook={onAdd} />
      </span>
    </div>
  );
}

/** What the book button says and shows, for a page not in the book and for one in it. */
const BOOK_BUTTON = {
  out: {
    variant: "outline",
    label: "Add to book",
    aria: "Add {name} to the book",
    Icon: BookPlusIcon,
  },
  in: {
    variant: "ghost",
    label: "Take out",
    aria: "Take {name} out of the book",
    Icon: BookMinusIcon,
  },
} as const;

/** **Add to book**, or **Take out** for a page in the book. */
function BookButton(props: { inBook: boolean; name: string; onBook: (inBook: boolean) => void }) {
  const { inBook, name, onBook } = props;
  const { variant, label, aria, Icon } = BOOK_BUTTON[inBook ? "in" : "out"];
  return (
    <Button
      size="sm"
      variant={variant}
      aria-label={aria.replace("{name}", name)}
      onClick={() => onBook(!inBook)}
    >
      <Icon />
      {label}
    </Button>
  );
}

interface ButtonProps {
  page: BookPage;
  /** How the button names the page, such as "page 3". */
  name: string;
}

/** A button for each layout, the page's own pressed, to switch it. */
function LayoutButtons({
  page,
  name,
  onLayout,
}: ButtonProps & { onLayout: (layout: PageLayout) => void }) {
  return (
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
          onClick={() => onLayout(layout.id)}
        >
          <LayoutGlyph layout={layout.id} className="h-3.5 w-4.5" />
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
