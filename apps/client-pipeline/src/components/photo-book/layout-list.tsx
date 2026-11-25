import { CopyPlusIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { SectionTitle } from "@/components/section-title";
import { Button } from "@/components/ui/button";
import type { BuiltInLayout, PageLayout, PhotoBook } from "@/lib/photo-book";
import { type LayoutChoice, everyLayoutChoice, pagesUsing } from "@/lib/photo-book-layouts";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

interface LayoutListProps {
  book: PhotoBook;
  selected: PageLayout;
  onSelect: (layout: PageLayout) => void;
  /** Makes a new layout from layout's settings. */
  onCustomize: (layout: PageLayout) => void;
  /** Hides the built-in layout id from the Photo Pages' layout buttons, or shows it again. */
  onHide: (id: BuiltInLayout, hide: boolean) => void;
}

/**
 * The built-in layouts, each to hide from the Photo Pages, then the book's own, each to pick and to
 * start a new layout from.
 */
export function LayoutList(props: LayoutListProps) {
  const choices = everyLayoutChoice(props.book);
  const own = choices.filter((c) => c.id.startsWith("custom-"));
  return (
    <nav aria-label="Layouts" className="flex flex-col gap-4">
      <section className="flex flex-col gap-1">
        <SectionTitle as="h2">Built in</SectionTitle>
        {choices
          .filter((c) => !c.id.startsWith("custom-"))
          .map((choice) => (
            <LayoutRow key={choice.id} choice={choice} {...props} />
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
          <LayoutRow key={choice.id} choice={choice} {...props} />
        ))}
      </section>
    </nav>
  );
}

/** Under a layout's name: hidden, or how many pages have it. */
function rowNote(used: number, hidden: boolean): string {
  if (hidden) return used > 0 ? `Hidden · on ${count(used, "page")}` : "Hidden from Photo Pages";
  return used > 0 ? `On ${count(used, "page")}` : "Not on any page";
}

/**
 * One layout in the list: its glyph, name and how many pages have it, the eye that hides a built-in
 * one, and Customize.
 */
function LayoutRow(props: LayoutListProps & { choice: LayoutChoice }) {
  const { book, choice, selected, onSelect, onCustomize } = props;
  const used = pagesUsing(book, choice.id);
  const hidden = (book.hiddenLayouts ?? []).includes(choice.id as BuiltInLayout);
  return (
    <div className="has-[[aria-current]]:bg-accent flex items-center gap-1 rounded-md pr-1 has-[[aria-pressed=true]]:opacity-60">
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
          <span className="text-muted-foreground text-xs">{rowNote(used, hidden)}</span>
        </span>
      </button>
      <HideButton {...props} hidden={hidden} />
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

/** The eye that hides a built-in layout from the Photo Pages' layout buttons, or shows it again. */
function HideButton(props: LayoutListProps & { choice: LayoutChoice; hidden: boolean }) {
  const { choice, hidden, onHide } = props;
  if (choice.id.startsWith("custom-")) return null;
  const Icon = hidden ? EyeOffIcon : EyeIcon;
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-pressed={hidden}
      aria-label={`Hide ${choice.label} from Photo Pages`}
      title={hidden ? "Hidden from Photo Pages; show it again" : "Hide from Photo Pages"}
      onClick={() => onHide(choice.id as BuiltInLayout, !hidden)}
    >
      <Icon />
    </Button>
  );
}
