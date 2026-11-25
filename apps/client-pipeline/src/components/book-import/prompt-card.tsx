import { CopyPromptButton } from "@/components/bulk-tagging/pick-controls";
import { ContactSheetsButton, useContactSheets } from "@/components/contact-sheets-button";
import { FieldLabel } from "@/components/field-label";
import { Segmented } from "@/components/lightroom-albums/segmented";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type BookSource,
  type CatalogDates,
  type CatalogPhoto,
  bookImportPrompt,
  catalogSheetPhotos,
} from "@/lib/book-import-prompt";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

const SOURCES: { value: BookSource; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "images", label: "Page images" },
];

interface PromptCardProps {
  source: BookSource;
  onSource: (source: BookSource) => void;
  dates: CatalogDates;
  onDates: (dates: CatalogDates) => void;
  /** The website photos the prompt lists, taken between the dates. */
  catalog: CatalogPhoto[];
}

/**
 * How to send the old book to an LLM, as a PDF or as images of its pages, the dates that limit the
 * catalog of website photos the prompt lists, optional contact sheets of them, and the prompt.
 */
export function PromptCard({ source, onSource, dates, onDates, catalog }: PromptCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Read the book with an LLM</CardTitle>
          <CardDescription>
            The prompt lists the website&apos;s photos for the LLM to match the book&apos;s against.
            Limit them to the dates the book covers to keep it short.
          </CardDescription>
        </div>
        <Segmented label="Send the book as" options={SOURCES} value={source} onChange={onSource} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <DateFields dates={dates} onDates={onDates} />
        <p className="text-muted-foreground">{catalogText(catalog.length, dates)}</p>
        {catalog.length === 0 ? (
          <EmptyNote>
            No photos were taken between these dates. Widen them to make a prompt.
          </EmptyNote>
        ) : (
          <PromptSteps source={source} dates={dates} catalog={catalog} />
        )}
      </CardContent>
    </Card>
  );
}

/** "120 photos in the catalog", saying undated photos are left out when a date is set. */
function catalogText(photos: number, { from, to }: CatalogDates): string {
  const undated = from || to ? ", leaving out photos with no date taken" : "";
  return `${count(photos, "photo")} in the catalog${undated}.`;
}

/** What to send the LLM, the contact sheets button and the copy button. */
function PromptSteps({ source, dates, catalog }: Omit<PromptCardProps, "onSource" | "onDates">) {
  const contact = useContactSheets(catalogSheetPhotos(catalog));
  return (
    <>
      <ol className="list-decimal space-y-1 ps-5">
        <li>
          Optionally, make contact sheets of the catalog, so the LLM looks through a few numbered
          sheets instead of opening every photo.
        </li>
        <li>{SEND[source]}</li>
        <li>
          Paste its answer under <strong>Import</strong>.
        </li>
      </ol>
      <ContactSheetsButton state={contact} />
      <CopyPromptButton
        label={`Copy the prompt for ${count(catalog.length, "photo")}`}
        disabled={false}
        prompt={() => bookImportPrompt({ source, photos: catalog, dates, sheets: contact.sheets })}
      />
    </>
  );
}

/** How to send the book with the prompt. */
const SEND: Record<BookSource, string> = {
  pdf: "Send the LLM the book's PDF with the prompt.",
  images:
    "Send the LLM the images of the book's pages, in order, with the prompt. Screenshots of two-page spreads are fine.",
};

const DATE_FIELDS = [
  {
    key: "from",
    label: "Taken from",
    help: "The first day the book's photos were taken, such as 2021-02-01. Empty for no limit.",
  },
  {
    key: "to",
    label: "Taken to",
    help: "The last day the book's photos were taken, that day included. Empty for no limit.",
  },
] as const;

/** The first and last days of the catalog, either one left empty for no limit. */
function DateFields({
  dates,
  onDates,
}: {
  dates: CatalogDates;
  onDates: (d: CatalogDates) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {DATE_FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={`book-import-${field.key}`} help={field.help}>
            {field.label}
          </FieldLabel>
          <Input
            id={`book-import-${field.key}`}
            type="date"
            className="w-44"
            value={dates[field.key]}
            onChange={(event) => onDates({ ...dates, [field.key]: event.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
