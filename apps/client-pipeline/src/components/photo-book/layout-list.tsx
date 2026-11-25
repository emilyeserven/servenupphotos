import { CopyPlusIcon } from "lucide-react";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { SectionTitle } from "@/components/section-title";
import { Button } from "@/components/ui/button";
import type { PageLayout, PhotoBook } from "@/lib/photo-book";
import { type LayoutChoice, layoutChoices, pagesUsing } from "@/lib/photo-book-layouts";
import { cn } from "@/lib/utils";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

interface LayoutListProps {
  book: PhotoBook;
  selected: PageLayout;
  onSelect: (layout: PageLayout) => void;
  /** Makes a new layout from layout's settings. */
  onCustomize: (layout: PageLayout) => void;
}

/** The built-in layouts, then the book's own, each to pick and to start a new layout from. */
export function LayoutList({ book, selected, onSelect, onCustomize }: LayoutListProps) {
  const choices = layoutChoices(book);
  const own = choices.filter((c) => c.id.startsWith("custom-"));
  return (
    <nav aria-label="Layouts" className="flex flex-col gap-4">
      <section className="flex flex-col gap-1">
        <SectionTitle as="h2">Built in</SectionTitle>
        {choices
          .filter((c) => !c.id.startsWith("custom-"))
          .map((choice) => (
            <LayoutRow
              key={choice.id}
              choice={choice}
              {...{ book, selected, onSelect, onCustomize }}
            />
          ))}
      </section>
      <section className="flex flex-col gap-1">
        <SectionTitle as="h2">This book&apos;s layouts</SectionTitle>
        {own.length === 0 && (
          <EmptyNote>
            No layouts of your own yet. Customize one to start from its settings.
          </EmptyNote>
        )}
        {own.map((choice) => (
          <LayoutRow
            key={choice.id}
            choice={choice}
            {...{ book, selected, onSelect, onCustomize }}
          />
        ))}
      </section>
    </nav>
  );
}

/** One layout in the list: its glyph, name and how many pages have it, and Customize. */
function LayoutRow(props: LayoutListProps & { choice: LayoutChoice }) {
  const { book, choice, selected, onSelect, onCustomize } = props;
  const used = pagesUsing(book, choice.id);
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md pr-1",
        choice.id === selected && "bg-accent",
      )}
    >
      <button
        type="button"
        aria-current={choice.id === selected ? "true" : undefined}
        onClick={() => onSelect(choice.id)}
        className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 text-left outline-none focus-visible:ring-2"
      >
        <LayoutGlyph
          layout={choice.id}
          look={choice.look}
          className="text-muted-foreground h-7 w-9 shrink-0"
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{choice.label}</span>
          <span className="text-muted-foreground text-xs">
            {used > 0 ? `On ${count(used, "page")}` : "Not on any page"}
          </span>
        </span>
      </button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Customize ${choice.label}`}
        title="Make a new layout from this one"
        onClick={() => onCustomize(choice.id)}
      >
        <CopyPlusIcon />
      </Button>
    </div>
  );
}
