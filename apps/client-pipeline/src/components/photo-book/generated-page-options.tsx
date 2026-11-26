import { MinusIcon, PlusIcon, Settings2Icon } from "lucide-react";
import type { PageLook } from "@/components/photo-book/page-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BookPage } from "@/lib/photo-book";
import { ENTRY_SIZES, entrySize, withEntrySize } from "@/lib/photo-book-entry-sizes";
import {
  GENERATED_COLUMNS,
  TEXT_SIZES,
  type GeneratedPage,
  type IndexDepth,
  type NameStyle,
  generatedTextSize,
  isGeneratedPage,
} from "@/lib/photo-book-generated";
import { MAX_GENERATED_PAGES } from "@/lib/photo-book-generated-pages";
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

/** A number with − and + buttons, between min and max, and a note after it. */
function Stepper(props: {
  label: string;
  value: number;
  shown: string;
  range: { min: number; max: number; step: number };
  note: string;
  onChange: (value: number) => void;
}) {
  const { label, value, shown, range, note, onChange } = props;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          size="icon-xs"
          variant="outline"
          aria-label={`Less ${label.toLowerCase()}`}
          disabled={value <= range.min}
          onClick={() => onChange(value - range.step)}
        >
          <MinusIcon />
        </Button>
        <span className="min-w-6 text-center tabular-nums">{shown}</span>
        <Button
          size="icon-xs"
          variant="outline"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= range.max}
          onClick={() => onChange(value + range.step)}
        >
          <PlusIcon />
        </Button>
        <span className="text-muted-foreground text-xs">{note}</span>
      </div>
    </div>
  );
}

/** The range the Pages stepper steps through. */
const PAGE_RANGE = { min: 1, max: MAX_GENERATED_PAGES, step: 1 };

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

/** The ways a generated page can write names, as the Names buttons offer them. */
const NAME_STYLES: { value: NameStyle | "plain"; name: string }[] = [
  { value: "plain", name: "As named" },
  { value: "namedLocal", name: "As named (local script)" },
  { value: "romanized", name: "Romanized" },
  { value: "romanizedLocal", name: "Romanized (local)" },
  { value: "localRomanized", name: "Local (romanized)" },
  { value: "local", name: "Local script" },
];

/** **Names**: how the Places Index writes names, a page saved with `localized` on showing as Local (romanized). */
function NamesChoice(props: { generated: GeneratedPage; onChange: (g: GeneratedPage) => void }) {
  const { generated: g, onChange } = props;
  const legacy = g.localized ? "localRomanized" : "plain";
  return (
    <Choices
      label="Names"
      choices={NAME_STYLES}
      value={g.names ?? legacy}
      onPick={(names) => onChange({ ...g, localized: undefined, names: nameStyle(names) })}
    />
  );
}

/** The name style picked, or none for names as the photos have them. */
function nameStyle(value: NameStyle | "plain"): NameStyle | undefined {
  return value === "plain" ? undefined : value;
}

const DEPTHS: { value: IndexDepth | "place"; name: string }[] = [
  { value: "place", name: "Every place" },
  { value: "city", name: "Cities" },
  { value: "state", name: "States" },
  { value: "country", name: "Countries" },
];

/** What the entry chips change: which entries are left out, and each entry's own size. */
interface EntryChanges {
  hidden: string[];
  onHidden: (hidden: string[]) => void;
  /** Each entry's own size, in percent of the list's, by its key. */
  sizes: Pick<GeneratedPage, "entrySizes">;
  onSize: (key: string, size: number) => void;
}

/** − and + buttons that make one entry's line smaller or put it back, its size shown while it's under 100%. */
function EntrySizeButtons(props: { name: string; size: number; onSize: (size: number) => void }) {
  const { name, size, onSize } = props;
  return (
    <span className="flex shrink-0 items-center">
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Smaller ${name}`}
        title="Make this line smaller"
        disabled={size <= ENTRY_SIZES.min}
        onClick={() => onSize(size - ENTRY_SIZES.step)}
      >
        <MinusIcon />
      </Button>
      {size < 100 && <span className="text-muted-foreground text-xs tabular-nums">{size}%</span>}
      {size < 100 && (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Larger ${name}`}
          title="Make this line larger"
          onClick={() => onSize(size + ENTRY_SIZES.step)}
        >
          <PlusIcon />
        </Button>
      )}
    </span>
  );
}

/** One entry's chip, which leaves it out or puts it back, and the buttons that size its line. */
function EntryChip({ entry, changes }: { entry: IndexEntry; changes: EntryChanges }) {
  const off = changes.hidden.includes(entry.key);
  return (
    <span className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        aria-pressed={off}
        title={off ? "Left out, click to put it back" : "Click to leave it out"}
        onClick={() => changes.onHidden(toggledHidden(changes.hidden, entry.key))}
        className={cn(
          "w-fit max-w-full truncate rounded-full border px-2 py-0.5 text-xs",
          off ? "text-muted-foreground border-dashed line-through" : "bg-primary/10",
        )}
      >
        {entry.name}
      </button>
      {!off && (
        <EntrySizeButtons
          name={entry.name}
          size={entrySize(changes.sizes, entry.key)}
          onSize={(size) => changes.onSize(entry.key, size)}
        />
      )}
    </span>
  );
}

/** Every entry the index could show, each to leave out or put back, or to make smaller. */
function EntryChips({ entries, changes }: { entries: IndexEntry[]; changes: EntryChanges }) {
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => (
        <li key={entry.key} className="flex flex-col gap-1">
          <EntryChip entry={entry} changes={changes} />
          {entry.children.length > 0 && (
            <div className="border-muted ml-2 border-l pl-2">
              <EntryChips entries={entry.children} changes={changes} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** How many pages the list runs on across, how many columns each has, and its text size. */
function PagesAndColumns(props: {
  generated: GeneratedPage;
  onChange: (g: GeneratedPage) => void;
}) {
  const { generated: g, onChange } = props;
  return (
    <>
      <Stepper
        label="Pages"
        value={g.pages ?? 1}
        shown={String(g.pages ?? 1)}
        range={PAGE_RANGE}
        note="linked, the list running on from one to the next"
        onChange={(pages) => onChange({ ...g, pages })}
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
      <Stepper
        label="Text size"
        value={generatedTextSize(g)}
        shown={`${generatedTextSize(g)}%`}
        range={TEXT_SIZES}
        note="of the usual size"
        onChange={(textSize) => onChange({ ...g, textSize })}
      />
      <Check
        label="Shrink lines to fit, by up to 20%, instead of wrapping"
        on={g.fitLines === true}
        onChange={(fitLines) => onChange({ ...g, fitLines })}
      />
    </>
  );
}

/** The Places Index's options: how names are written, how deep and in what order, and its columns. */
function IndexOptions(props: { generated: GeneratedPage; onChange: (g: GeneratedPage) => void }) {
  const { generated: g, onChange } = props;
  return (
    <>
      <NamesChoice generated={g} onChange={onChange} />
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
      <PagesAndColumns generated={g} onChange={onChange} />
    </>
  );
}

/** Every entry the Places Index could show, how many are left out, and each to leave out, put back or make smaller. */
function IndexEntries({ every, changes }: { every: IndexEntry[]; changes: EntryChanges }) {
  const { hidden } = changes;
  const left = hidden.length > 0 ? `, ${hidden.length} left out` : "";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">
        Places ({count(entryCount(every), "entry", "entries")}
        {left})
      </span>
      <span className="text-muted-foreground text-xs">
        Click one to leave it out; the places in it move up a level. − makes its line smaller, such
        as one that wraps by a letter or two.
      </span>
      {every.length > 0 ? (
        <EntryChips entries={every} changes={changes} />
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
          changes={{
            hidden: g.hidden ?? [],
            onHidden: (next) => changes.onChange(page.id, (old) => ({ ...old, hidden: next })),
            sizes: g,
            onSize: (key, size) =>
              changes.onChange(page.id, (old) => ({
                ...old,
                entrySizes: withEntrySize(old.entrySizes, key, size),
              })),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
