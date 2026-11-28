import { BookmarkPlusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { CombinedData } from "@/api/photos";
import { saveStandardLayoutsMutation, standardLayoutsFile } from "@/api/standard-layouts";
import { LayoutGlyph } from "@/components/photo-book/layout-glyph";
import { SaveState } from "@/components/save-state";
import { SectionTitle } from "@/components/section-title";
import { Button } from "@/components/ui/button";
import { useDelayedDraft } from "@/hooks/use-delayed-draft";
import type { BuiltInLayout, CustomLayout, PhotoBook } from "@/lib/photo-book";
import { describeLook } from "@/lib/photo-book-layouts";
import {
  type StandardLayouts,
  copyOf,
  linkedStandard,
  removeStandard,
  saveAsStandard,
  setHiddenEverywhere,
} from "@/lib/photo-book-standard";
import { askFirst } from "@/stores/confirm";
import { EmptyNote } from "@portfolio/components/empty-note";

/** What the Layouts tab selects a standard layout by, so it isn't mixed up with the book's own. */
const STANDARD_PREFIX = "standard:";

/** The Layouts tab's selection key for the standard layout with ID id. */
function standardKey(id: string): string {
  return `${STANDARD_PREFIX}${id}`;
}

/** The ID of the standard layout a Layouts tab selection key picks, or undefined for any other. */
export function standardIdOf(key: string): string | undefined {
  return key.startsWith(STANDARD_PREFIX) ? key.slice(STANDARD_PREFIX.length) : undefined;
}

/**
 * The photo books' standard layouts file being edited and a function that changes it, each change
 * saved as a change waiting for Commit shortly after the last one.
 */
export function useStandardLayouts(data: CombinedData) {
  const { value, update, error, saving } = useDelayedDraft(
    standardLayoutsFile(data),
    saveStandardLayoutsMutation,
  );
  return { file: value, update, error, saving };
}

/** The standard layouts file, how to change it, and how its last change was saved. */
export interface StandardProps {
  file: StandardLayouts;
  updateFile: (file: StandardLayouts) => void;
  saving: boolean;
  error: Error | null;
}

/**
 * The Layouts tab's **Standard layouts**: the layouts saved from any book, each to pick, preview
 * and add to this book.
 */
export function StandardList(props: {
  book: PhotoBook;
  file: StandardLayouts;
  selected: string;
  onSelect: (key: string) => void;
  onAdd: (id: string) => void;
}) {
  const { book, file, selected, onSelect, onAdd } = props;
  return (
    <section className="flex flex-col gap-1">
      <SectionTitle as="h2">Standard layouts</SectionTitle>
      {file.layouts.length === 0 && (
        <EmptyNote>
          No standard layouts yet. Save one of a book&apos;s layouts as standard to use it in every
          book.
        </EmptyNote>
      )}
      {file.layouts.map((layout) => {
        const key = standardKey(layout.id);
        const copy = copyOf(book, layout.id);
        return (
          <div
            key={layout.id}
            className="has-[[aria-current]]:bg-accent flex items-center gap-1 rounded-md pr-1"
          >
            <button
              type="button"
              aria-current={key === selected ? "true" : undefined}
              onClick={() => onSelect(key)}
              className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 text-left outline-none focus-visible:ring-2"
            >
              <LayoutGlyph
                layout={layout.id}
                look={layout}
                className="text-muted-foreground h-7 w-9 shrink-0"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{layout.name}</span>
                <span className="text-muted-foreground text-xs">
                  {copy ? `In this book as “${copy.name}”` : "Not in this book"}
                </span>
              </span>
            </button>
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={copy !== undefined}
              aria-label={`Add ${layout.name} to this book`}
              title={copy ? "Already in this book" : "Add to this book"}
              onClick={() => onAdd(layout.id)}
            >
              <PlusIcon />
            </Button>
          </div>
        );
      })}
    </section>
  );
}

/**
 * The picked standard layout's settings: its description, **Add to this book** (or the book's copy
 * of it, to edit), and **Remove from standard layouts**.
 */
export function StandardSettings(
  props: StandardProps & {
    book: PhotoBook;
    id: string;
    onAdd: () => void;
    onOpenCopy: (id: CustomLayout["id"]) => void;
    onRemoved: () => void;
  },
) {
  const { book, file, updateFile, id, onAdd, onOpenCopy, onRemoved, saving, error } = props;
  const layout = file.layouts.find((l) => l.id === id);
  if (!layout) return <EmptyNote>This standard layout was removed.</EmptyNote>;
  const copy = copyOf(book, id);
  const remove = async () => {
    const yes = await askFirst({
      question: `Remove the standard layout “${layout.name}”?`,
      note: "Books that added it keep their own copy of it.",
      action: "Remove standard layout",
    });
    if (!yes) return;
    updateFile(removeStandard(file, id));
    onRemoved();
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{layout.name}</p>
      <p className="text-muted-foreground text-sm">{describeLook(layout)}</p>
      <p className="text-muted-foreground text-sm">
        Standard layouts can be used in every book. Adding one gives this book its own copy, to use
        on Photo Pages and to change; <strong>Update standard layout</strong> on the copy saves its
        changes back.
      </p>
      <div className="flex flex-wrap gap-2">
        {copy ? (
          <Button size="sm" variant="outline" onClick={() => onOpenCopy(copy.id)}>
            Open “{copy.name}”
          </Button>
        ) : (
          <Button size="sm" onClick={onAdd}>
            <PlusIcon />
            Add to this book
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => void remove()}>
          <Trash2Icon />
          Remove from standard layouts
        </Button>
      </div>
      <SavingNote saving={saving} error={error} />
    </div>
  );
}

/**
 * **Save as standard layout** under one of the book's own layouts, or **Update standard layout**
 * when it was saved as or added from one that's still there, so every book can use it.
 */
export function SaveStandardButton(
  props: StandardProps & {
    book: PhotoBook;
    custom: CustomLayout;
    update: (book: PhotoBook) => void;
  },
) {
  const { book, custom, update, file, updateFile, saving, error } = props;
  const linked = linkedStandard(file, custom);
  const save = async () => {
    if (!(await mayReplace(linked))) return;
    const saved = saveAsStandard(file, book, custom.id);
    updateFile(saved.file);
    update(saved.book);
  };
  return (
    <div className="flex flex-col gap-1">
      <div>
        <Button size="sm" variant="outline" onClick={() => void save()}>
          <BookmarkPlusIcon />
          {linked ? "Update standard layout" : "Save as standard layout"}
        </Button>
      </div>
      <SavingNote saving={saving} error={error} />
    </div>
  );
}

/** "Saving…" while the standard layouts file is being saved, or why it failed; nothing once saved. */
function SavingNote({ saving, error }: { saving: boolean; error: Error | null }) {
  if (!saving && !error) return null;
  return <SaveState saving={saving} error={error} />;
}

/** Whether to save over the standard layout linked: yes when there's none, else once asked. */
async function mayReplace(linked: CustomLayout | undefined): Promise<boolean> {
  if (!linked) return true;
  return askFirst({
    question: `Update the standard layout “${linked.name}”?`,
    note: "Its settings are replaced with this layout's. Books that already added it keep their own copy as it is.",
    action: "Update standard layout",
  });
}

/** **Hide in every book** under a built-in layout, which takes it out of every book's Photo Pages. */
export function HideEverywhereField(props: StandardProps & { id: BuiltInLayout }) {
  const { id, file, updateFile, saving, error } = props;
  const hidden = (file.hiddenLayouts ?? []).includes(id);
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={hidden}
          onChange={(event) => updateFile(setHiddenEverywhere(file, id, event.target.checked))}
        />
        Hide in every book
      </label>
      <p className="text-muted-foreground text-xs">
        Leaves it out of the layout buttons and Add page of every book&apos;s Photo Pages, not only
        this one&apos;s. The eye beside it hides it in this book only.
      </p>
      <SavingNote saving={saving} error={error} />
    </div>
  );
}
