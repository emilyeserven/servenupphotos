import { PencilIcon } from "lucide-react";
import { pageName } from "@/components/photo-book/page-types";
import type { BookPage } from "@/lib/photo-book";
import { isGeneratedPage } from "@/lib/photo-book-generated";
import { savedPageId } from "@/lib/photo-book-generated-pages";
import { isEditablePage } from "@/lib/photo-book-page-editor";
import { cn } from "@/lib/utils";

/** What the button on an editable page says: "Edit text", or "Edit index" on a generated page. */
function editLabel(page: BookPage): string {
  return isGeneratedPage(page) ? "Edit index" : "Edit text";
}

/**
 * Over the pages the preview shows, laid out as they are: each text page and generated page is a
 * button that opens it in the page editor, with an **Edit text** (or **Edit index**) chip at its
 * top right; the one open in the editor is outlined. Other pages take no clicks.
 */
export function PageEditTargets(props: {
  pages: BookPage[];
  /** The ID of the page open in the editor, if one is. */
  open: string | null;
  onEdit: (id: string) => void;
}) {
  const { pages, open, onEdit } = props;
  return (
    <div
      className="pointer-events-none absolute inset-0 grid gap-px"
      style={{ gridTemplateColumns: `repeat(${pages.length}, minmax(0, 1fr))` }}
    >
      {pages.map((page) =>
        isEditablePage(page) ? (
          <button
            key={page.id}
            type="button"
            aria-label={`${editLabel(page)} of ${pageName(page)}`}
            onClick={() => onEdit(page.id)}
            className={cn(
              "group/edit hover:ring-primary/70 focus-visible:ring-primary pointer-events-auto relative cursor-pointer rounded-sm outline-none hover:ring-2 focus-visible:ring-2",
              open !== null && savedPageId(open) === savedPageId(page.id) && "ring-primary ring-2",
            )}
          >
            <span className="bg-background/90 text-foreground absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs opacity-70 shadow group-hover/edit:opacity-100 group-focus-visible/edit:opacity-100">
              <PencilIcon className="size-3" />
              {editLabel(page)}
            </span>
          </button>
        ) : (
          <div key={page.id} />
        ),
      )}
    </div>
  );
}
