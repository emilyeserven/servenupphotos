import { Settings2Icon } from "lucide-react";
import type { PageLook } from "@/components/photo-book/page-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BookPage } from "@/lib/photo-book";
import {
  GENERATED_COLUMNS,
  type GeneratedPage,
  type IndexDepth,
  isGeneratedPage,
} from "@/lib/photo-book-generated";
import { toggledHidden } from "@/lib/photo-book-hidden";
import { type IndexEntry, entryCount } from "@/lib/photo-book-places-index";
import { cn } from "@/lib/utils";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/** What a generated page's options change: its options, and its heading. */
export interface GeneratedPageChanges {
  /** Changes the options of the generated page with ID id. */
  onChange: (id: string, change: (generated: GeneratedPage) => GeneratedPage) => void;
  /** Sets the heading of the page with ID id. */
  onTitle: (id: string, title: string) => void;
}

/** A row of buttons picking one of a few choices, the picked one pressed. */
function Choices<T extends string | number>(props: {
  label: string;
  choices: { value: T; name: string }[];
  value: T;
  onPick: (value: T) => void;
}) {
  const { label, choices, value, onPick } = props;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {choices.map((choice) => (
          <Button
            key={choice.value}
            size="xs"
            variant={choice.value === value ? "default" : "outline"}
            aria-pressed={choice.value === value}
            onClick={() => onPick(choice.value)}
          >
            {choice.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** A checkbox with its words. */
function Check(props: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={props.on}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {props.label}
    </label>
  );
}

const DEPTHS: { value: IndexDepth | "place"; name: string }[] = [
  { value: "place", name: "Every place" },
  { value: "city", name: "Cities" },
  { value: "state", name: "States" },
  { value: "country", name: "Countries" },
];

/** Every entry the index could show, each a button that leaves it out or puts it back. */
function EntryChips(props: {
  entries: IndexEntry[];
  hidden: string[];
  onHidden: (hidden: string[]) => void;
}) {
  const { entries, hidden, onHidden } = props;
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => {
        const off = hidden.includes(entry.key);
        return (
          <li key={entry.key} className="flex flex-col gap-1">
            <button
              type="button"
              aria-pressed={off}
              title={off ? "Left out, click to put it back" : "Click to leave it out"}
              onClick={() => onHidden(toggledHidden(hidden, entry.key))}
              className={cn(
                "w-fit max-w-full truncate rounded-full border px-2 py-0.5 text-xs",
                off ? "text-muted-foreground border-dashed line-through" : "bg-primary/10",
              )}
            >
              {entry.name}
            </button>
            {entry.children.length > 0 && (
              <div className="border-muted ml-2 border-l pl-2">
                <EntryChips entries={entry.children} hidden={hidden} onHidden={onHidden} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The Places Index's options: how names are written, how deep and in what order, and its columns. */
function IndexOptions(props: { generated: GeneratedPage; onChange: (g: GeneratedPage) => void }) {
  const { generated: g, onChange } = props;
  return (
    <>
      <Check
        label="Names in their own script, with romanization"
        on={g.localized === true}
        onChange={(localized) => onChange({ ...g, localized })}
      />
      <Check
        label="Abbreviate US states"
        on={g.stateAbbreviations === true}
        onChange={(stateAbbreviations) => onChange({ ...g, stateAbbreviations })}
      />
      <Choices
        label="List down to"
        choices={DEPTHS}
        value={g.depth ?? "place"}
        onPick={(depth) => onChange({ ...g, depth: depth === "place" ? undefined : depth })}
      />
      <Choices
        label="Order"
        choices={[
          { value: "alpha", name: "Alphabetical" },
          { value: "book", name: "As the book shows them" },
        ]}
        value={g.order ?? "alpha"}
        onPick={(order) => onChange({ ...g, order: order === "book" ? "book" : undefined })}
      />
      <Choices
        label="Columns"
        choices={Array.from({ length: GENERATED_COLUMNS }, (_, i) => ({
          value: i + 1,
          name: String(i + 1),
        }))}
        value={g.columns ?? 1}
        onPick={(columns) => onChange({ ...g, columns })}
      />
    </>
  );
}

/** Every entry the Places Index could show, how many are left out, and each to leave out or put back. */
function IndexEntries(props: {
  every: IndexEntry[];
  hidden: string[];
  onHidden: (hidden: string[]) => void;
}) {
  const { every, hidden, onHidden } = props;
  const left = hidden.length > 0 ? `, ${hidden.length} left out` : "";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">
        Places ({count(entryCount(every), "entry", "entries")}
        {left})
      </span>
      <span className="text-muted-foreground text-xs">
        Click one to leave it out; the places in it move up a level.
      </span>
      {every.length > 0 ? (
        <EntryChips entries={every} hidden={hidden} onHidden={onHidden} />
      ) : (
        <EmptyNote>No places yet. Put pages with photos that have places in the book.</EmptyNote>
      )}
    </div>
  );
}

/** The heading box of a generated page. */
function HeadingField(props: { title: string | null; onTitle: (title: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      Heading
      <Input
        value={props.title ?? ""}
        placeholder="No heading"
        onChange={(event) => props.onTitle(event.target.value)}
        className="h-8"
      />
    </label>
  );
}

/**
 * The options button on a generated page in the Book tab's drawer: its heading, how the Places
 * Index writes and orders its places, and every entry it could show, each to leave out. Nothing
 * for a page or spread that isn't generated.
 */
export function GeneratedPageOptions(props: {
  pages: BookPage[];
  look: PageLook;
  changes: GeneratedPageChanges;
}) {
  const page = props.pages.find(isGeneratedPage);
  if (!page) return null;
  return <OptionsPopover page={page} look={props.look} changes={props.changes} />;
}

/** The options button and its popover, for a generated page. */
function OptionsPopover(props: {
  page: BookPage & { generated: GeneratedPage };
  look: PageLook;
  changes: GeneratedPageChanges;
}) {
  const { page, look, changes } = props;
  const g = page.generated;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-xs" variant="ghost" aria-label={`${page.name} options`} title="Options">
          <Settings2Icon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[70vh] w-80 flex-col gap-3 overflow-y-auto p-3 text-sm"
      >
        <p className="text-muted-foreground text-xs">
          Made from the places of the photos on the pages in the book each time it&apos;s shown, so
          it stays current as pages change.
        </p>
        <HeadingField title={page.title} onTitle={(title) => changes.onTitle(page.id, title)} />
        <IndexOptions generated={g} onChange={(next) => changes.onChange(page.id, () => next)} />
        <IndexEntries
          every={look.placesIndexFor({ ...g, hidden: undefined })}
          hidden={g.hidden ?? []}
          onHidden={(next) => changes.onChange(page.id, (old) => ({ ...old, hidden: next }))}
        />
      </PopoverContent>
    </Popover>
  );
}
