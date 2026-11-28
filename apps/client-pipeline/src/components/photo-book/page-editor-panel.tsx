import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Choices,
  GeneratedPageForm,
  Stepper,
} from "@/components/photo-book/generated-page-options";
import { type PageLook, pageActions } from "@/components/photo-book/page-actions";
import { pageName } from "@/components/photo-book/page-types";
import { SectionTitle } from "@/components/section-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type BookPage, type PhotoBook, TEXT_PAGE_PHOTOS, renamePage } from "@/lib/photo-book";
import {
  type GeneratedPage,
  changeGenerated,
  generatedKind,
  isGeneratedPage,
  setGeneratedTitle,
} from "@/lib/photo-book-generated";
import { editablePageIndex } from "@/lib/photo-book-page-editor";
import { TEXT_PAGE_COLUMNS, type TextPlace, textColumns, textPlace } from "@/lib/photo-book-text";

/** The book being edited, what changes it, and how its pages are drawn. */
interface EditorProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  look: PageLook;
}

/** A labelled box in the editor. */
function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {props.label}
      {props.children}
    </label>
  );
}

/** The choices of where a text page's text goes, as the editor's Text buttons offer them. */
const TEXT_PLACES: { value: TextPlace; name: string }[] = [
  { value: "above", name: "Above the photos" },
  { value: "left", name: "Left" },
  { value: "right", name: "Right" },
];

/** The column counts a text page's text can flow into. */
const COLUMN_CHOICES = Array.from({ length: TEXT_PAGE_COLUMNS }, (_, i) => ({
  value: i + 1,
  name: String(i + 1),
}));

/** The range the Photos stepper steps through. */
const PHOTO_RANGE = { min: 0, max: TEXT_PAGE_PHOTOS, step: 1 };

/** A text page's title, and a note when the book hides page titles. */
function TitleField(props: {
  title: string | null;
  hidden: boolean;
  onTitle: (title: string) => void;
}) {
  return (
    <Field label="Title">
      <Input
        value={props.title ?? ""}
        placeholder="No title"
        onChange={(event) => props.onTitle(event.target.value)}
        className="h-8"
      />
      {props.hidden && (
        <span className="text-muted-foreground font-normal">
          Show page titles is off on Info, so the title doesn&apos;t show.
        </span>
      )}
    </Field>
  );
}

/** A text page's name, title and Markdown text. */
function TextFields(props: EditorProps & { page: BookPage; index: number }) {
  const { book, update, page, index } = props;
  const actions = pageActions(book, index, update);
  return (
    <>
      <Field label="Name">
        <Input
          value={page.name ?? ""}
          placeholder="Untitled page"
          onChange={(event) => update(renamePage(book, index, event.target.value))}
          className="h-8"
        />
      </Field>
      <TitleField
        title={page.title}
        hidden={book.noTitles === true}
        onTitle={(title) => actions.onTitle(title)}
      />
      <Field label="Text, in Markdown">
        <Textarea
          value={page.text ?? ""}
          placeholder="**bold**, *italic*, # headings, - lists, > quotes"
          onChange={(event) => actions.onText(event.target.value)}
          className="min-h-48 font-mono"
        />
        <span className="text-muted-foreground font-normal">
          Each line break is kept. The page shows it drawn as you type.
        </span>
      </Field>
    </>
  );
}

/** A text page's columns, its photo places and where its text goes beside them. */
function TextLayoutFields(props: EditorProps & { page: BookPage; index: number }) {
  const { book, update, page, index } = props;
  const actions = pageActions(book, index, update);
  const photos = page.slots.length;
  return (
    <>
      <Choices
        label="Columns"
        choices={COLUMN_CHOICES}
        value={textColumns(page)}
        onPick={actions.onColumns}
      />
      <Stepper
        label="Photos"
        value={photos}
        shown={String(photos)}
        range={PHOTO_RANGE}
        note="places, filled from the drawer on Photo Pages or in Edit mode"
        onChange={actions.onPhotoPlaces}
      />
      {photos > 0 && (
        <Choices
          label="Text"
          choices={TEXT_PLACES}
          value={textPlace(page)}
          onPick={actions.onTextPlace}
        />
      )}
    </>
  );
}

/** A generated page's options, changing the book as they change. */
function GeneratedForm(props: EditorProps & { page: BookPage & { generated: GeneratedPage } }) {
  const { book, update, look, page } = props;
  return (
    <GeneratedPageForm
      page={page}
      look={look}
      changes={{
        onChange: (id, change) => update(changeGenerated(book, id, change)),
        onTitle: (id, title) => update(setGeneratedTitle(book, id, title)),
      }}
    />
  );
}

/** What the editor's heading says it edits: "Text page" or the generated page's kind, such as "Places Index". */
function editorTitle(page: BookPage): string {
  return isGeneratedPage(page) ? generatedKind(page.generated.kind).name : "Text page";
}

/**
 * The page editor: a panel beside the Book tab's preview, in place of Used page spreads, that edits
 * the text page or generated page clicked in the preview, so it's edited where it's seen instead of
 * scrolled to on Photo Pages or in the drawer. The preview shows each change as it's made, and
 * clicking another page there switches to it. Nothing while id names no page to edit.
 */
export function PageEditorPanel(props: EditorProps & { id: string; onClose: () => void }) {
  const { book, id, onClose } = props;
  const index = editablePageIndex(book, id);
  const page = book.pages[index];
  if (!page) return null;
  return (
    <aside
      aria-label="Page editor"
      className="flex max-h-[36rem] w-full shrink-0 flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-14rem)] lg:w-64"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <SectionTitle as="h2">{editorTitle(page)}</SectionTitle>
          <span className="text-muted-foreground truncate text-xs">{pageName(page)}</span>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          <XIcon />
          Done
        </Button>
      </div>
      <div className="-mr-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 pb-1 text-sm">
        {isGeneratedPage(page) ? (
          <GeneratedForm {...props} page={page} />
        ) : (
          <>
            <TextFields {...props} page={page} index={index} />
            <TextLayoutFields {...props} page={page} index={index} />
          </>
        )}
      </div>
    </aside>
  );
}
