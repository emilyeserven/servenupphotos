import { EyeIcon, EyeOffIcon, HeadingIcon, Trash2Icon } from "lucide-react";
import { MoveArrows } from "@/components/move-arrows";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { type BookPageProps, type PageActions, pageName } from "@/components/photo-book/page-types";
import { Button } from "@/components/ui/button";
import { type BookPage, inBook, LAYOUTS } from "@/lib/photo-book";
import { cn } from "@/lib/utils";

type PageControlsProps = Pick<BookPageProps, "page" | "index" | "number" | "last" | "actions">;

/** How the page's buttons name it, such as "page 3" or "left-out page 4". */
function buttonName(index: number, number: number | null): string {
  return number === null ? `left-out page ${index + 1}` : `page ${number}`;
}

/**
 * The page's number, its layout, a title to add or take off, whether it's in the book, arrows to
 * move it, and Remove.
 */
export function PageControls({ page, index, number, last, actions }: PageControlsProps) {
  const name = buttonName(index, number);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className={cn("mr-1 text-sm font-medium", !inBook(page) && "text-muted-foreground")}>
        {pageName(number)}
      </span>
      <LayoutButtons page={page} name={name} onLayout={actions.onLayout} />
      <TitleButton page={page} name={name} onTitle={actions.onTitle} />
      <LeftOutButton page={page} name={name} onLeftOut={actions.onLeftOut} />
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

interface ButtonProps {
  page: BookPage;
  /** How the button names the page, such as "page 3". */
  name: string;
}

/** A button for each layout, the page's own pressed, to switch it. */
function LayoutButtons({ page, name, onLayout }: ButtonProps & Pick<PageActions, "onLayout">) {
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

/** **H**: adds a title above the page's top photo, or takes it off. */
function TitleButton({ page, name, onTitle }: ButtonProps & Pick<PageActions, "onTitle">) {
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

/** What the eye button says and shows, for a page in the book and for one left out. */
const LEFT_OUT_BUTTON = {
  in: {
    variant: "ghost",
    label: "Leave {name} out of the book",
    title: "Leave out of the book",
    Icon: EyeIcon,
  },
  out: {
    variant: "secondary",
    label: "Put {name} in the book",
    title: "Put in the book",
    Icon: EyeOffIcon,
  },
} as const;

/** The eye: leaves the page out of the book, keeping it to compare, or puts it back in. */
function LeftOutButton({ page, name, onLeftOut }: ButtonProps & Pick<PageActions, "onLeftOut">) {
  const out = !inBook(page);
  const { variant, label, title, Icon } = LEFT_OUT_BUTTON[out ? "out" : "in"];
  return (
    <Button
      size="icon-xs"
      variant={variant}
      aria-pressed={out}
      aria-label={label.replace("{name}", name)}
      title={title}
      onClick={() => onLeftOut(!out)}
    >
      <Icon />
    </Button>
  );
}
