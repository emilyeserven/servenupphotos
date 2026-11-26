import { ShuffleIcon } from "lucide-react";
import { useState } from "react";
import type { CombinedData } from "@/api/photos";
import { photoLabel, previewPhotos } from "@/components/caption-templates/preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type CaptionValues,
  PLACEHOLDERS,
  captionLists,
  captionValues,
} from "@/lib/caption-template";

/** Another photo's index than current, out of count; current when there's no other. */
function shuffled(current: number, count: number): number {
  if (count < 2) return current;
  const next = Math.floor(Math.random() * (count - 1));
  return next >= current ? next + 1 : next;
}

/** A placeholder's button, which puts it in the template. */
function PlaceholderButton({ name, onInsert }: { name: string; onInsert: (p: string) => void }) {
  return (
    <button
      type="button"
      className="bg-muted hover:bg-accent rounded px-1.5 py-0.5 font-mono text-xs"
      onClick={() => onInsert(`{${name}}`)}
    >
      {`{${name}}`}
    </button>
  );
}

/** What the placeholder is filled with for the example photo, or a note that it's empty. */
function Example({ value }: { value: string | undefined }) {
  if (!value) return <span className="text-muted-foreground italic">Empty for this photo</span>;
  return <span className="whitespace-pre-wrap">{value}</span>;
}

interface PlaceholderRowsProps {
  names: string[];
  help: string;
  values: CaptionValues;
  onInsert: (placeholder: string) => void;
}

/** One row for each placeholder that goes together, what they are said once beside them all. */
function PlaceholderRows({ names, help, values, onInsert }: PlaceholderRowsProps) {
  return names.map((name, i) => (
    <TableRow key={name} className={i > 0 ? "border-t-0" : undefined}>
      <TableCell className="align-top">
        <PlaceholderButton name={name} onInsert={onInsert} />
      </TableCell>
      {i === 0 && (
        <TableCell
          rowSpan={names.length}
          className="text-muted-foreground align-top whitespace-normal"
        >
          {help}
        </TableCell>
      )}
      <TableCell className="align-top whitespace-normal">
        <Example value={values[name]} />
      </TableCell>
    </TableRow>
  ));
}

interface PlaceholderListProps {
  /** The combined lists, for the example photo and its places. */
  data: CombinedData;
  onInsert: (placeholder: string) => void;
}

/**
 * The placeholders a template can use, as a table: each a button that puts it in the template, what
 * it is, and what it's filled with for one of the portfolio's photos, which **Shuffle** swaps for
 * another.
 */
export function PlaceholderList({ data, onInsert }: PlaceholderListProps) {
  const photos = previewPhotos(data);
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  const values = captionValues(photo ?? {}, captionLists(data), ["travelphotography"]);
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Placeholders</CardTitle>
          <CardDescription>
            Click one to put it in the template. Any other field of the photo JSON with text or a
            number works too, such as {"{customCity}"} or {"{createDate}"}. The examples are{" "}
            {photo ? `from “${photoLabel(photo, index)}”` : "empty without a photo"}, with
            #travelphotography as its post&apos;s hashtags.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={photos.length < 2}
          onClick={() => setIndex(shuffled(index, photos.length))}
        >
          <ShuffleIcon />
          Shuffle
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placeholder</TableHead>
              <TableHead>What it is</TableHead>
              <TableHead>Example</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PLACEHOLDERS.map(({ names, help }) => (
              <PlaceholderRows
                key={names[0]}
                names={names}
                help={help}
                values={values}
                onInsert={onInsert}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
